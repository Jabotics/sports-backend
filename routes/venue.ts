import sharp from "sharp";
import { IVenue } from "../types/types";
import { CustomRequest } from "../server";
import CustomError from "../errors/customError";
import { City, Venue } from "../schemas/schema";
import asyncHandler from "../errors/asyncHandler";
import { Request, Response, Router } from "express";
import verifyJWT from "../middlewares/authentication";
import { FilterQuery, SortOrder, Types } from "mongoose";
import { add, menus, remove, update, view } from "../middlewares/permission";
import { validateArrayData, validateObjectData } from "../lib/helpers/validation";
import { capitalizeString, findFile, removeMultipleFiles, response200, saveImage, uploadPaths } from "../lib/helpers/utils";
import { add_venue_schema, get_venue_schema, remove_venue_schema, update_venue_image_schema, update_venue_schema, venues_schema } from "../validation/venueValidation";

interface VenueQuery extends FilterQuery<IVenue> {
    $or?: Array<{ [key: string]: any }>;
    is_active?: {
        $in: Array<Boolean>;
    };
    _id?: {
        $in: Array<Types.ObjectId>;
    };
    city?: Types.ObjectId;
}

interface venue_data {
    name?: string;
    address?: string;
    city?: string;
    supported_sports?: string[];
    image?: string[];
    video?: string[];
    is_active?: boolean;
    geo_location?: string;
    type?: string;
}

const router = Router();

router.post('/add-venue', [verifyJWT, add(menus.Venues)], asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    //Validating requested data
    const validation = validateObjectData(add_venue_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const count = await City.countDocuments({ _id: reqData.city, is_active: true, soft_delete: false });
    if (count == 0) throw new CustomError("City does not exist or is disabled", 406)

    const findExisting = await Venue.find(
        {
            city: reqData.city,
            name: capitalizeString(reqData.name),
            soft_delete: false
        });

    if (findExisting.length != 0) throw new CustomError("Venue already exists", 409);

    //Preparing data for saving to the database
    const data = {
        type: reqData.type,
        city: reqData.city,
        address: reqData.address,
        geo_location: reqData.geo_location,
        name: capitalizeString(reqData.name),
        supported_sports: reqData.supported_sports,
    }
    const newVenue = await Venue.create(data);

    const response = response200("Venue added successfully", { id: newVenue._id });
    return res.status(response[0]).json(response[1]);

}));

router.get('/get-venues', [verifyJWT, view(menus.Venues)], asyncHandler(async (req: CustomRequest, res: Response) => {
    let reqQuery = req.query;
    reqQuery = {
        ...reqQuery,
        is_active: req.query.is_active && JSON.parse(String(reqQuery.is_active))
    }
    const user = req.user;

    //Validating requested data
    const validation = validateObjectData(get_venue_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    let where: VenueQuery = {
        soft_delete: false
    };

    // Preparing where clause for the query
    if (reqQuery.search) {
        where.$or = [{ name: { $regex: String(reqQuery.search), $options: 'i' } }];
    }
    var regExp = new RegExp("true");
    if (reqQuery.is_active && Array.isArray(reqQuery.is_active) && reqQuery.is_active.length != 0) {
        const active_status = reqQuery.is_active.map((status) => {
            return regExp.test(String(status));
        });
        where.is_active = { $in: active_status }
    }
    reqQuery.city && (where.city = new Types.ObjectId(String(reqQuery.city)));
    reqQuery.id && (where._id = { $in: [new Types.ObjectId(String(reqQuery.id))] });

    if (user && 'city' in user && user.city) {
        where.city = user.city._id;
    }

    //Sorting options
    const sortOptions: string | { [key: string]: SortOrder | { $meta: any; }; } | [string, SortOrder][] | null | undefined = [];
    if (reqQuery.orderBy) {
        sortOptions.push([String(reqQuery.orderBy), reqQuery.sort === 'asc' ? 1 : -1]);
    } else {
        sortOptions.push(["createdAt", 1]);
    }

    //Fetching venues
    const venues = (await Venue.find(where)
        .lean()
        .populate({ path: 'city', select: 'name', options: { strictPopulate: false } })
        .populate({ path: 'supported_sports', select: ['name', 'icon'], options: { strictPopulate: false } })
        .sort(sortOptions)
        .skip(Number(reqQuery.offset))
        .limit(Number(reqQuery.limit)))
        .map((venue) => {
            return {
                id: venue._id,
                name: venue.name,
                city: venue.city,
                address: venue.address,
                geo_location: venue.geo_location,
                image: venue.image,
                video: venue.video,
                type: venue.type,
                supported_sports: venue.supported_sports,
                is_active: venue.is_active,
            }
        })

    const count = await Venue.countDocuments(where);

    const response = response200("All venues fetched successfully", { count, venues });
    return res.status(response[0]).json(response[1]);
}));

router.post('/update-venue', [verifyJWT, update(menus.Venues)], asyncHandler(async (req: Request, res: Response) => {
    let reqData = req.body;
    reqData = { ...reqData, deleted_files: reqData.deleted_files && JSON.parse(reqData.deleted_files) };
    const reqImages = req.files;

    const validation = validateObjectData(update_venue_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if (reqData.city) {
        const count = await City.countDocuments({ _id: reqData.city, is_active: true, soft_delete: false });
        if (count == 0) throw new CustomError("City does not exist or is disabled", 406);
    }

    if (Array.isArray(reqImages) && reqImages?.length != 0) {
        const imgValidation = validateArrayData(update_venue_image_schema, reqImages);
        if (imgValidation.error) throw new CustomError(imgValidation.error.message, 406, imgValidation.error.details[0].context?.key);
    }

    if (reqData.deleted_files && Array.isArray(reqData.deleted_files)) {
        await removeMultipleFiles(reqData.deleted_files);
    }

    const data: venue_data = {
        name: reqData?.name,
        type: reqData?.type,
        city: reqData?.city,
        address: reqData?.address,
        is_active: reqData?.is_active,
        geo_location: reqData?.geo_location,
        supported_sports: reqData.supported_sports,
    }

    if (Array.isArray(reqImages) && reqImages.length != 0) {
        for (let i in reqImages) {
            const compressedBuffer = await new Promise<Buffer>((resolve, reject) => {
                sharp(reqImages[i].buffer as Buffer)
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
            await saveImage(uploadPaths.venue, `${reqData.id}-${reqImages[i].originalname}`, compressedBuffer);
        }
    }
    let url = await findFile(reqData.id, uploadPaths.venue);
    data.image = url;

    await Venue.findByIdAndUpdate(
        { _id: reqData.id },
        { $set: data }
    );

    const response = response200("Venue updated successfully", {});
    return res.status(response[0]).json(response[1]);
}));

router.post('/remove-venues', [verifyJWT, remove(menus.Venues)], asyncHandler(async (req: Request, res: Response) => {
    const reqIds = req.body.venueIds;

    const validation = validateArrayData(remove_venue_schema, reqIds);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    await Venue.updateMany(
        { _id: { $in: reqIds } },
        { $set: { soft_delete: true } }
    );

    const response = response200("Venue removed successfully", {});
    return res.status(response[0]).json(response[1]);
}));

router.get('/fetch-venues', verifyJWT, asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqQuery = req.query;
    const user = req.user;

    if (!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(get_venue_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    let where: VenueQuery = {
        soft_delete: false,
        is_active: {
            $in: [true]
        }
    };

    if (user && 'city' in user && user.city) {
        where.city = user.city._id;
    }

    reqQuery.city && (where.city = new Types.ObjectId(String(reqQuery.city)))

    if ('venue' in user && Array.isArray(user.venue) && user.venue.length != 0) {
        const venueIds = user.venue.map((id) => {
            return new Types.ObjectId(String(id));
        });
        where._id = { $in: venueIds }
    }

    const venues = (await Venue.find(where))
        .map((venue) => {
            return {
                id: venue.id,
                name: venue.name
            }
        });

    const response = response200("Venues fetched successfully", venues);
    return res.status(response[0]).json(response[1]);
}));

//For user side only
router.get('/venues', asyncHandler(async (req: Request, res: Response) => {
    const reqQuery = req.query;

    const validation = validateObjectData(venues_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: VenueQuery = {
        soft_delete: false,
        is_active: {
            $in: [true]
        }
    }
    reqQuery.city && (where.city = new Types.ObjectId(String(reqQuery.city)));

    const venues = (await Venue.find(where)).map((venue) => {
        return {
            id: venue.id,
            name: venue.name
        }
    });

    const response = response200("", venues);
    return res.status(response[0]).json(response[1]);
}));
export default router;