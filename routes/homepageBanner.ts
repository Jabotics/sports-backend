import sharp from "sharp";
import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { HomepageBanner } from "../schemas/schema";
import { Request, Response, Router } from "express";
import verifyJWT from "../middlewares/authentication";
import { image_validation_schema } from "../validation/imageValidation";
import { add, menus, remove, update, view } from "../middlewares/permission";
import { validateArrayData, validateObjectData } from "../lib/helpers/validation";
import { findFile, removeFile, response200, saveImage, uploadPaths } from "../lib/helpers/utils";
import { add_banner_schema, remove_banner_schema, update_banner_schema } from "../validation/homepageBannerValidation";

const router = Router();

interface update_data {
    url?: string;
    type?: string;
    image?: string;
    is_active?: string;
}

router.post('/add-banner', [verifyJWT, add(menus.HOMEPAGE)] ,asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;
    const reqImages = req.files;

    const validation = validateObjectData(add_banner_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if (Array.isArray(reqImages) && reqImages?.length != 0) {
        const imgValidation = validateObjectData(image_validation_schema, reqImages[0]);
        if (imgValidation.error) throw new CustomError(imgValidation.error.message, 406, imgValidation.error.details[0].context?.key);
    }

    const data = {
        url: reqData?.url,
        type: reqData.type
    }

    const newBanner = await HomepageBanner.create(data);

    if (Array.isArray(reqImages) && reqImages.length != 0) {
        const compressedBuffer = await new Promise<Buffer>((resolve, reject) => {
            sharp(reqImages[0].buffer as Buffer)
                .jpeg({ quality: 20 })
                .toBuffer((err, compressedBuffer) => {
                    if (err) {
                        console.log(err);
                        reject(err);
                    }
                    else {
                        resolve(compressedBuffer);
                    }
                });
        });
        await saveImage(uploadPaths.homepage, `${newBanner._id}-${reqImages[0].originalname}`, compressedBuffer);
    }
    let url = await findFile(newBanner._id, uploadPaths.homepage);    

    await HomepageBanner.findByIdAndUpdate(newBanner._id, {image: url[0]});

    const response = response200("Banner added successfully", {id: newBanner._id});
    return res.status(response[0]).json(response[1]);
}));

router.get('/get-banners', [verifyJWT, view(menus.HOMEPAGE)] ,asyncHandler(async (req: Request, res: Response)=>{
    const reqQuery = req.query;

    const where = {
        soft_delete: false
    }

    const banners = (await HomepageBanner.find(where)).map((banner)=>{
        return {
            id: banner._id,
            url: banner.url,
            type: banner.type,
            image: banner.image,
            is_active: banner.is_active
        }
    });

    const count = await HomepageBanner.countDocuments(where);

    const response = response200("Banners fetched successfully", {count, banners});
    return res.status(response[0]).json(response[1]);
}));

router.post('/update-banner', [verifyJWT, update(menus.HOMEPAGE)] ,asyncHandler(async (req: Request, res: Response)=>{
    const reqData = req.body;
    const reqImages = req.files;

    const validation = validateObjectData(update_banner_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if (reqImages && Array.isArray(reqImages) && reqImages?.length != 0) {
        const imgValidation = validateObjectData(image_validation_schema, reqImages[0]);
        if (imgValidation.error) throw new CustomError(imgValidation.error.message, 406, imgValidation.error.details[0].context?.key);
    }

    const data: update_data = {  
        url: reqData?.url,
        type: reqData?.type,
        is_active: reqData.is_active
    }

    if (reqImages && Array.isArray(reqImages) && reqImages.length != 0) {
        await removeFile(uploadPaths.homepage, reqData.id);
        const compressedBuffer = await new Promise<Buffer>((resolve, reject) => {
            sharp(reqImages[0].buffer as Buffer)
                .jpeg({ quality: 40 })
                .toBuffer((err, compressedBuffer) => {
                    if (err) {
                        console.log(err);
                        reject(err);
                    }
                    else {
                        resolve(compressedBuffer);
                    }
                });
        });
        await saveImage(uploadPaths.homepage, `${reqData.id}-${reqImages[0].originalname}`, compressedBuffer);
        let url = await findFile(reqData.id, uploadPaths.homepage);    
        data.image = url[0];
    }

    await HomepageBanner.findByIdAndUpdate(reqData.id, data);

    const response = response200("Banner updated successfully", {id: reqData.id});
    return res.status(response[0]).json(response[1]);
}));

router.post('/remove-banners', [verifyJWT, remove(menus.HOMEPAGE)] ,asyncHandler(async (req: Request, res: Response)=>{
    const reqIds = req.body.bannerIds;

    const validation = validateArrayData(remove_banner_schema, reqIds);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    await HomepageBanner.updateMany(
        {_id: {$in: reqIds}},
        {$set: {soft_delete: true}}
    );

    const response = response200(`${reqIds.length > 1 ? 'Banners' : 'Banner'} removed successfully`, {});
    return res.status(response[0]).json(response[1]);
}));

//For user side
router.get('/banners', asyncHandler(async (req: Request, res: Response)=>{    
    const where = {
        soft_delete: false,
        is_active: true
    }

    const banners = (await HomepageBanner.find(where)).map((banner)=>{
        return {
            id: banner._id,
            url: banner.url,
            type: banner.type,
            image: banner.image,            
        }
    });

    const count = await HomepageBanner.countDocuments(where);

    const response = response200("Banners fetched successfully", {count, banners});
    return res.status(response[0]).json(response[1]);
}));

export default router;