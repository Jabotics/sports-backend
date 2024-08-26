import NodeCache from "node-cache";
import { ISport } from "../types/types";
import { Sport } from "../schemas/schema";
import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { Request, Response, Router } from "express";
import verifyJWT from "../middlewares/authentication";
import { FilterQuery, SortOrder, Types } from "mongoose";
import { add, menus, remove, update, view } from "../middlewares/permission";
import { validateArrayData, validateObjectData, validateStringData } from "../lib/helpers/validation";
import { capitalizeString, findFile, response200, saveImage, uploadPaths } from "../lib/helpers/utils";
import { add_image_schema, add_sport_schema, get_sports_schema, remove_sport_schema, update_sports_schema } from "../validation/sportValidation";

interface sport_data {
    name?: string;
    icon?: string;
    is_active?: boolean;
}

interface SportQuery extends FilterQuery<ISport> {
    $or?: Array<{ [key: string]: any }>;
    is_active?: boolean;
    _id?: {
        $in: Array<Types.ObjectId>;
    };
}

const router = Router();
const cache = new NodeCache();

router.post('/add-sport', [verifyJWT, add(menus.Sports)], asyncHandler(async (req: Request, res: Response) => {
    const name = req.body.name;
    const reqImage = req.files;

    const validation = validateStringData(add_sport_schema, name);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if (Array.isArray(reqImage) && reqImage?.length != 0) {
        const imgValidation = validateObjectData(add_image_schema, reqImage[0]);
        if (imgValidation.error) throw new CustomError(imgValidation.error.message, 406, imgValidation.error.details[0].context?.key);
    }

    const findExisting = await Sport.find({ name: capitalizeString(name), soft_delete: false });
    if (findExisting.length != 0) throw new CustomError("Sport name already exists", 409);

    const data: sport_data = {
        name: capitalizeString(name),
    }

    if (Array.isArray(reqImage) && reqImage.length != 0) {
        // const compressedBuffer = await new Promise<Buffer>((resolve, reject) => {
        //     sharp(reqImage[0].buffer as Buffer)
        //         .jpeg({ quality: 80 })
        //         .toBuffer((err, compressedBuffer) => {
        //             if (err) {
        //                 console.log(err);
        //                 reject(err);
        //             }
        //             else {
        //                 resolve(compressedBuffer);
        //             }
        //         });
        // });
        await saveImage(uploadPaths.sports, `${reqImage[0].originalname}`, reqImage[0].buffer);
        let url = await findFile(reqImage[0].originalname, uploadPaths.sports);
        data.icon = url[0];
    }

    const newSport = await Sport.create(data);
    cache.del('sports');

    const response = response200("Sport added successfully", { id: newSport._id });
    return res.status(response[0]).json(response[1]);
}));

router.get('/get-all-sports', [verifyJWT, view(menus.Sports)], asyncHandler(async (req: Request, res: Response) => {
    const reqQuery = req.query;

    const validation = validateObjectData(get_sports_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: SportQuery = {
        soft_delete: false
    }

    if (reqQuery.search) {
        where.$or = [{ name: { $regex: String(reqQuery.search), $options: 'i' } }];
    }

    var regExp = new RegExp("true");
    reqQuery.is_active && (where.is_active = regExp.test(String(reqQuery.is_active)));
    if (reqQuery.id && Array.isArray(reqQuery.id)) {
        let ids = reqQuery.id.map((id) => new Types.ObjectId(String(id)));
        where._id = { $in: ids }
    }

    const sortOptions: string | { [key: string]: SortOrder | { $meta: any; }; } | [string, SortOrder][] | null | undefined = [];

    if (reqQuery.orderBy) {
        sortOptions.push([String(reqQuery.orderBy), reqQuery.sort === 'asc' ? 1 : -1]);
    } else {
        sortOptions.push(["createdAt", 1]);
    }

    if (!cache.get('sports')) {
        const sports = (await Sport.find(where)
            .sort(sortOptions)
            .skip(Number(reqQuery.offset))
            .limit(Number(reqQuery.limit))).map((sport) => {
                return {
                    id: sport._id,
                    name: sport.name,
                    icon: sport.icon,
                    is_active: sport.is_active
                }
            });
        cache.set("sports", sports, 10000);
    }
    const count = await Sport.countDocuments(where);
    const sports = cache.get('sports')

    const response = response200("All cities fetched successfully", { count, sports });
    return res.status(response[0]).json(response[1]);
}));

router.post('/update-sport', [verifyJWT, update(menus.Sports)], asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;
    const reqImage = req.files;

    const validation = validateObjectData(update_sports_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if (Array.isArray(reqImage) && reqImage?.length != 0) {
        const imgValidation = validateObjectData(add_image_schema, reqImage[0]);
        if (imgValidation.error) throw new CustomError(imgValidation.error.message, 406, imgValidation.error.details[0].context?.key);
    }

    const data: sport_data = {
        name: reqData.name && capitalizeString(reqData.name),
        is_active: reqData.is_active
    }

    if (Array.isArray(reqImage) && reqImage.length != 0) {
        await saveImage(uploadPaths.sports, `${reqImage[0].originalname}`, reqImage[0].buffer);
        let url = await findFile(reqImage[0].originalname, uploadPaths.sports);
        data.icon = url[0];
    }

    await Sport.findByIdAndUpdate(
        { _id: reqData.id },
        { $set: data }
    );
    cache.del('sports');

    const response = response200("Sport updated successfully", {});
    return res.status(response[0]).json(response[1]);
}));

router.post('/remove-sports', [verifyJWT, remove(menus.Sports)], asyncHandler(async (req: Request, res: Response) => {
    const reqIds = req.body.sportIds;

    const validation = validateArrayData(remove_sport_schema, reqIds);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    await Sport.updateMany(
        { _id: { $in: reqIds } },
        { $set: { soft_delete: true } }
    );
    cache.del('sports');

    const response = response200("Sport removed successfully", {});
    return res.status(response[0]).json(response[1]);
}));

router.get('/fetch-sports', asyncHandler(async (req: Request, res: Response) => {
    const reqQuery = req.query;

    const validation = validateObjectData(get_sports_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: SportQuery = {
        soft_delete: false
    }

    if (reqQuery.search) {
        where.$or = [{ name: { $regex: String(reqQuery.search), $options: 'i' } }];
    }

    var regExp = new RegExp("true");
    reqQuery.is_active && (where.is_active = regExp.test(String(reqQuery.is_active)));
    if (reqQuery.id && Array.isArray(reqQuery.id)) {
        let ids = reqQuery.id.map((id) => new Types.ObjectId(String(id)));
        where._id = { $in: ids }
    }

    const sortOptions: string | { [key: string]: SortOrder | { $meta: any; }; } | [string, SortOrder][] | null | undefined = [];

    if (reqQuery.orderBy) {
        sortOptions.push([String(reqQuery.orderBy), reqQuery.sort === 'asc' ? 1 : -1]);
    } else {
        sortOptions.push(["createdAt", 1]);
    }

    if (!cache.get('sports')) {
        const sports = (await Sport.find(where)
            .sort(sortOptions)
            .skip(Number(reqQuery.offset))
            .limit(Number(reqQuery.limit))).map((sport) => {
                return {
                    id: sport._id,
                    name: sport.name,
                    icon: sport.icon,
                    is_active: sport.is_active
                }
            });
        cache.set("sports", sports, 10000);
    }
    const count = await Sport.countDocuments(where);
    const sports = cache.get('sports')

    const response = response200("sports", { count, sports });
    return res.status(response[0]).json(response[1]);
}));

//For user side only
router.get('/sports', asyncHandler(async (req: Request, res: Response) => {
    const where: SportQuery = {
        soft_delete: false,
        is_active: true
    }

    const sports = (await Sport.find(where)).map((sport) => {
        return {
            id: sport._id,
            name: sport.name,
            icon: sport.icon,
        }
    });

    const response = response200("", sports);
    return res.status(response[0]).json(response[1]);
}));

export default router;