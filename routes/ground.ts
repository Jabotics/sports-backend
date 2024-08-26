import sharp from "sharp";
import { CustomRequest } from "../server";
import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { Request, Response, Router } from "express";
import { GroundType, IGround } from "../types/types";
import verifyJWT from "../middlewares/authentication";
import { FilterQuery, SortOrder, Types } from "mongoose";
import { City, Ground, PromoCode, SlotTime, Venue } from "../schemas/schema";
import { add, menus, remove, update, view } from "../middlewares/permission";
import { validateArrayData, validateObjectData } from "../lib/helpers/validation";
import { capitalizeString, findFile, removeMultipleFiles, response200, saveImage, uploadPaths } from "../lib/helpers/utils";
import { add_ground_schema, fetch_grounds_schema, grounds_schema, remove_ground_schema, update_ground_image_schema, update_ground_schema } from "../validation/groundValidation";


interface GroundQuery extends FilterQuery<IGround> {
    $or?: Array<{ [key: string]: any }>;
    is_active?: {
        $in: Array<Boolean>;
    };
    venue?: { $in: Types.ObjectId[] };
    _id?: {
        $in: Types.ObjectId[]
    };
    city?: Types.ObjectId;
    ground_type?: {
        $in: Array<GroundType>;
    },
    supported_sports?: {
        $in: Types.ObjectId[]
    }
    is_popular?: boolean;
}

interface ground_data {
    name?: string;
    venue?: string;
    address?: string;
    slots?: boolean;
    membership?: boolean;
    academy?: boolean;
    is_active?: boolean;
    is_popular?: boolean;
    dimensions?: boolean;
    images?: string[],
    video?: string[],
    multisports_support?: boolean;
    supported_sports?: Array<Types.ObjectId>;
    ground_type?: GroundType;
    rules?: object;
    amenities?: string[];
}

const router = Router();

router.post('/add-ground', [verifyJWT, add(menus.Grounds)], asyncHandler(async (req: CustomRequest, res: Response) => {
    let reqData = req.body;
    reqData = { ...reqData, supported_sports: reqData.supported_sports && JSON.parse(reqData.supported_sports) };
    const user = req.user;
    const reqFiles = req.files;

    if (!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(add_ground_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);


    if (Array.isArray(reqFiles) && reqFiles?.length != 0) {
        const imgValidation = validateArrayData(update_ground_image_schema, reqFiles);
        if (imgValidation.error) throw new CustomError(imgValidation.error.message, 406, imgValidation.error.details[0].context?.key);
    }

    const cityCount = await City.countDocuments({ _id: reqData.city, is_active: true, soft_delete: false });
    if (cityCount == 0) throw new CustomError("City does not exist or is disabled", 406);

    const count = await Venue.countDocuments({ _id: reqData.venue, is_active: true, soft_delete: false });
    if (count == 0) throw new CustomError("Venue does not exist or is disabled", 406);

    if (user && user.is_subadmin && 'venue' in user && Array.isArray(user.venue) && !user.venue.includes(reqData.venue)) {
        throw new CustomError("Permission denied", 403);
    }

    if ('venue' in user && Array.isArray(reqData.venue) && reqData.venue.length != 0 && !user.venue.includes(reqData.venue)) throw new CustomError("Permission denied", 403);

    const findExisting = await Ground.find({ name: capitalizeString(reqData.name), venue: reqData.venue, soft_delete: false });
    if (findExisting.length != 0) throw new CustomError("Ground name already exists", 409);

    if (reqData.multisports_support && !reqData.supported_sports) throw new CustomError("Sports are required for multisports ground", 406);
    if (reqData.multisports_support && reqData.multisports_support == true && reqData.supported_sports.length <= 1) throw new CustomError("At least 2 sports are required for multisports ground", 406);

    const data = {
        city: reqData.city,
        name: reqData.name,
        venue: reqData.venue,
        slots: reqData?.slots,
        video: reqData?.video,
        rules: reqData?.rules,
        academy: reqData?.academy,
        amenities: reqData?.amenities,
        dimensions: reqData.dimensions,
        membership: reqData?.membership,
        ground_type: reqData.ground_type,
        supported_sports: reqData?.supported_sports,
        multisports_support: reqData?.multisports_support,
    }

    const ground = await Ground.create(data);

    if (Array.isArray(reqFiles) && reqFiles.length != 0) {
        for (let i in reqFiles) {
            const compressedBuffer = await new Promise<Buffer>((resolve, reject) => {
                sharp(reqFiles[i].buffer as Buffer)
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
            await saveImage(uploadPaths.grounds, `${ground._id}-${reqFiles[i].originalname}`, compressedBuffer);
        }
    }
    let url = await findFile(ground._id, uploadPaths.grounds);

    await Ground.updateOne(
        { _id: ground._id, },
        { $set: { images: url } }
    );

    const price = {
        sun: 1300,
        mon: 800,
        tue: 800,
        wed: 800,
        thu: 800,
        fri: 1000,
        sat: 1200,
    }

    const slots = [
        { time: "06:00 AM - 07:00 AM", price: price },
        { time: "07:00 AM - 08:00 AM", price: price },
        { time: "08:00 AM - 09:00 AM", price: price },
        { time: "09:00 AM - 10:00 AM", price: price },
        { time: "10:00 AM - 11:00 AM", price: price },
        { time: "11:00 AM - 12:00 PM", price: price },
        { time: "12:00 PM - 01:00 PM", price: price },
        { time: "01:00 PM - 02:00 PM", price: price },
        { time: "02:00 PM - 03:00 PM", price: price },
        { time: "03:00 PM - 04:00 PM", price: price },
        { time: "04:00 PM - 05:00 PM", price: price },
        { time: "05:00 PM - 06:00 PM", price: price },
        { time: "06:00 PM - 07:00 PM", price: price },
        { time: "07:00 PM - 08:00 PM", price: price },
        { time: "08:00 PM - 09:00 PM", price: price },
        { time: "09:00 PM - 10:00 PM", price: price },
    ]

    let promises: any[] = [];
    slots.forEach(async (slot) => {
        const newSlot = new SlotTime({
            ground: ground._id,
            city: reqData.city,
            venue: reqData.venue,
            slot: slot.time,
            price: slot.price
        });

        promises.push(newSlot.save());
    });

    await Promise.all(promises);

    const response = response200("Ground created successfully", { id: ground._id });
    return res.status(response[0]).json(response[1]);
}));

router.get('/get-all-grounds', [verifyJWT, view(menus.Grounds)], asyncHandler(async (req: CustomRequest, res: Response) => {
    let reqQuery = req.query;
    reqQuery = {
        ...reqQuery,
        venue: reqQuery.venue && JSON.parse(String(reqQuery.venue)),
        is_active: reqQuery.is_active && JSON.parse(String(reqQuery.is_active)),
    }
    const user = req.user;

    const validation = validateObjectData(fetch_grounds_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if (!user) {
        throw new CustomError("Permission denied", 403);
    }
    else {
        const where: GroundQuery = {
            soft_delete: false
        }
        if (!user.is_superadmin && !user.is_admin && !user.is_subadmin) {
            if ('venue' in user && Array.isArray(user.venue)) {
                where.venue = { $in: user.venue }
            }
        }

        if (reqQuery.search) {
            where.$or = [
                { name: { $regex: String(reqQuery.search), $options: 'i' } },
                { address: { $regex: String(reqQuery.search), $options: 'i' } }
            ];
        }
        var regExp = new RegExp("true");
        if (reqQuery.is_active && Array.isArray(reqQuery.is_active) && reqQuery.is_active.length != 0) {
            const active_status = reqQuery.is_active.map((status) => {
                return regExp.test(String(status));
            });
            where.is_active = { $in: active_status }
        }
        reqQuery.academy && (where.academy = regExp.test(String(reqQuery.academy)));
        reqQuery.membership && (where.membership = regExp.test(String(reqQuery.membership)));
        reqQuery.multisports_support && (where.multisports_support = regExp.test(String(reqQuery.multisports_support)));
        reqQuery.id && (where._id = { $in: [new Types.ObjectId(String(reqQuery.id))] });
        // reqQuery.ground_type && (where.ground_type = {$in: reqQuery.ground_type})

        if (reqQuery.ground_type && Array.isArray(reqQuery.ground_type)) {
            let x = reqQuery.ground_type.map((type) => {
                if (typeof type === 'string' && Object.values(GroundType).includes(type as GroundType)) {
                    return type as GroundType;
                }
            }).filter((item): item is GroundType => item !== undefined);

            where.ground_type = { $in: x }
        }

        if (reqQuery.venue && Array.isArray(reqQuery.venue) && reqQuery.venue.length != 0) {
            const venueIds = reqQuery.venue.map((id) => {
                return new Types.ObjectId(String(id));
            });
            where.venue = { $in: venueIds }
        }

        if ('venue' in user && Array.isArray(user.venue) && user.venue.length != 0) {
            const venueIds = user.venue.map((id) => {
                return new Types.ObjectId(String(id));
            });
            where.venue = { $in: venueIds }
        }

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

        const venuePopulateOptions = {
            path: 'venue',
            select: 'name',
            options: { strictPopulate: false }
        }

        const grounds = (await Ground.find(where)
            .populate(venuePopulateOptions)
            .populate({ path: 'supported_sports', select: ['name', 'icon'], options: { strictPopulate: false } })
            .sort(sortOptions)
            .skip(Number(reqQuery.offset))
            .limit(Number(reqQuery.limit)))
            .filter((ground) => ground.venue !== null)
            .map((ground) => {
                return {
                    id: ground.id,
                    venue: ground.venue,
                    name: ground.name,
                    dimensions: ground.dimensions,
                    slots: ground.slots,
                    academy: ground.academy,
                    membership: ground.membership,
                    images: ground.images,
                    video: ground.video,
                    multisports_support: ground.multisports_support,
                    supported_sports: ground.supported_sports,
                    rules: ground.rules,
                    amenities: ground.amenities,
                    ground_type: ground.ground_type,
                    is_active: ground.is_active,
                }
            });

        const count = await Ground.countDocuments(where);

        const response = response200("All grounds fetched successfully", { count, grounds });
        return res.status(response[0]).json(response[1]);
    }
}));

router.post('/update-ground', [verifyJWT, update(menus.Grounds)], asyncHandler(async (req: CustomRequest, res: Response) => {
    let reqData = req.body;
    reqData = {
        ...reqData,
        deleted_files: reqData.deleted_files && JSON.parse(reqData.deleted_files),
        supported_sports: reqData.supported_sports && JSON.parse(reqData.supported_sports),
        rules: reqData.rules && JSON.parse(reqData.rules),
        amenities: reqData.amenities && JSON.parse(reqData.amenities)
    }
    const reqFiles = req.files;
    const user = req.user;

    if (!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(update_ground_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if (reqData.venue) {
        const count = await Venue.countDocuments({ _id: reqData.venue, is_active: true, soft_delete: false });
        if (count == 0) throw new CustomError("Venue does not exist or is disabled", 406)
    }

    if (Array.isArray(reqFiles) && reqFiles?.length != 0) {
        const imgValidation = validateArrayData(update_ground_image_schema, reqFiles);
        if (imgValidation.error) throw new CustomError(imgValidation.error.message, 406, imgValidation.error.details[0].context?.key);
    }

    if (reqData.supported_sports && Array.isArray(reqData.supported_sports) && reqData.supported_sports.length > 1 && !reqData.multisports_support) {
        const ground = await Ground.findById({ _id: reqData.id });
        if (ground && !ground.multisports_support) throw new CustomError("Ground does not supports multi sports", 406);
    }

    if (reqData.venue) {
        if ('venue' in user && Array.isArray(reqData.venue) && reqData.venue.length != 0 && !user.venue.includes(reqData.venue)) throw new CustomError("Permission denied", 403);
    }

    const data: ground_data = {
        name: reqData?.name,
        venue: reqData?.venue,
        slots: reqData?.slots,
        rules: reqData?.rules,
        video: reqData?.video,
        academy: reqData?.academy,
        address: reqData?.address,
        amenities: reqData?.amenities,
        is_active: reqData?.is_active,
        is_popular: reqData?.is_popular,
        membership: reqData?.membership,
        dimensions: reqData?.dimensions,
        ground_type: reqData?.ground_type,
        supported_sports: reqData?.supported_sports,
        multisports_support: reqData?.multisports_support,
    }

    if (reqData.deleted_files && Array.isArray(reqData.deleted_files)) {
        await removeMultipleFiles(reqData.deleted_files);
    }

    if (Array.isArray(reqFiles) && reqFiles.length != 0) {
        for (let i in reqFiles) {
            const compressedBuffer = await new Promise<Buffer>((resolve, reject) => {
                sharp(reqFiles[i].buffer as Buffer)
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
            await saveImage(uploadPaths.grounds, `${reqData.id}-${reqFiles[i].originalname}`, compressedBuffer);
        }
    }
    let imageUrl = await findFile(reqData.id, uploadPaths.grounds);
    data.images = imageUrl;

    await Ground.findByIdAndUpdate(
        { _id: reqData.id },
        { $set: data }
    )

    const response = response200("Ground updated successfully", {});
    return res.status(response[0]).json(response[1]);

}));

router.post('/remove-grounds', [verifyJWT, remove(menus.Grounds)], asyncHandler(async (req: Request, res: Response) => {
    const reqIds = req.body.groundIds;

    const validation = validateArrayData(remove_ground_schema, reqIds);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    await Ground.updateMany(
        { _id: { $in: reqIds } },
        { $set: { soft_delete: true } }
    );

    const response = response200("Ground removed successfully", {});
    return res.status(response[0]).json(response[1]);
}));

router.get('/fetch-grounds', verifyJWT, asyncHandler(async (req: CustomRequest, res: Response) => {
    let reqQuery = req.query;
    reqQuery = {
        ...reqQuery,
        venue: reqQuery.venue && JSON.parse(String(reqQuery.venue))
    }

    const user = req.user;

    const validation = validateObjectData(fetch_grounds_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if (!user) {
        throw new CustomError("Permission denied", 403);
    }
    else {
        const where: GroundQuery = {
            soft_delete: false,
            is_active: {
                $in: [true]
            }
        }
        if (!user.is_superadmin && !user.is_admin && !user.is_subadmin) {
            if ('venue' in user && Array.isArray(user.venue)) {
                where.venue = { $in: user.venue }
            }
        }

        if ('added_by' in user && user.ground && user.ground.length !== 0) {
            where._id = { $in: user.ground };
        }

        if (reqQuery.search) {
            where.$or = [
                { name: { $regex: String(reqQuery.search), $options: 'i' } },
                { address: { $regex: String(reqQuery.search), $options: 'i' } }
            ];
        }
        var regExp = new RegExp("true");
        reqQuery.id && (where._id = { $in: [new Types.ObjectId(String(reqQuery.id))] });
        reqQuery.academy && (where.academy = regExp.test(String(reqQuery.academy)));
        if (reqQuery.is_active && Array.isArray(reqQuery.is_active) && reqQuery.is_active.length != 0) {
            const active_status = reqQuery.is_active.map((status) => {
                return regExp.test(String(status));
            });
            where.is_active = { $in: active_status }
        }
        reqQuery.membership && (where.membership = regExp.test(String(reqQuery.membership))); `1`
        reqQuery.multisports_support && (where.multisports_support = regExp.test(String(reqQuery.multisports_support)));

        if (reqQuery.venue && Array.isArray(reqQuery.venue) && reqQuery.venue.length != 0) {
            const venueIds = reqQuery.venue.map((id) => {
                return new Types.ObjectId(String(id));
            });
            where.venue = { $in: venueIds }
        }

        if ('venue' in user && Array.isArray(user.venue) && user.venue.length != 0 && !reqQuery.venue) {
            const venueIds = user.venue.map((id) => {
                return new Types.ObjectId(String(id));
            });
            where.venue = { $in: venueIds }
        }

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

        const venuePopulateOptions = {
            path: 'venue',
            select: 'name',
            options: { strictPopulate: false }
        }

        const grounds = (await Ground.find(where)
            .populate(venuePopulateOptions)
            .populate({ path: 'supported_sports', select: ['name', 'icon'], options: { strictPopulate: false } })
            .sort(sortOptions)
            .skip(Number(reqQuery.offset))
            .limit(Number(reqQuery.limit)))
            .filter((ground) => ground.venue !== null)
            .map((ground) => {
                return {
                    id: ground.id,
                    venue: ground.venue,
                    name: ground.name,
                    slots: ground.slots,
                    multisports_support: ground.multisports_support,
                    supported_sports: ground.supported_sports,
                    rules: ground.rules,
                    academy: ground.academy,
                    membership: ground.membership,
                    ground_type: ground.ground_type,
                }
            });

        const count = await Ground.countDocuments(where);

        const response = response200("All grounds fetched successfully", { count, grounds });
        return res.status(response[0]).json(response[1]);
    }
}));

//For user side only
router.get('/grounds', asyncHandler(async (req: Request, res: Response) => {
    let reqQuery = req.query;
    reqQuery = {
        ...reqQuery,
        supported_sports: reqQuery.supported_sports && JSON.parse(String(reqQuery.supported_sports)),
        venue: reqQuery.venue && JSON.parse(String(reqQuery.venue)),
        ground_type: reqQuery.ground_type && JSON.parse(String(reqQuery.ground_type))
    }

    const validation = validateObjectData(grounds_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: GroundQuery = {
        soft_delete: false,
        is_active: {
            $in: [true]
        },
    }
    var regExp = new RegExp("true");
    reqQuery.academy && (where.academy = regExp.test(String(reqQuery.academy)));
    reqQuery.is_popular && (where.is_popular = regExp.test(String(reqQuery.is_popular)));
    reqQuery.membership && (where.membership = regExp.test(String(reqQuery.membership)));
    reqQuery.id && (where._id = { $in: [new Types.ObjectId(String(reqQuery.id))] });
    reqQuery.city && (where.city = new Types.ObjectId(String(reqQuery.city)));

    if (reqQuery.venue && Array.isArray(reqQuery.venue) && reqQuery.venue.length != 0) {
        const venueIds = reqQuery.venue.map((id) => {
            return new Types.ObjectId(String(id));
        });
        where.venue = { $in: venueIds }
    }

    if (reqQuery.ground_type && Array.isArray(reqQuery.ground_type)) {
        let ground_type = reqQuery.ground_type.map((type) => {
            if (typeof type === 'string' && Object.values(GroundType).includes(type as GroundType)) {
                return type as GroundType;
            }
        }).filter((item): item is GroundType => item !== undefined);

        where.ground_type = { $in: ground_type }
    }

    if (reqQuery.supported_sports && Array.isArray(reqQuery.supported_sports) && reqQuery.supported_sports.length != 0) {
        let sports = reqQuery.supported_sports.map((sport) => {
            return new Types.ObjectId(String(sport));
        });
        where.supported_sports = { $in: sports }
    }
    const sortOptions: string | { [key: string]: SortOrder | { $meta: any; }; } | [string, SortOrder][] | null | undefined = [];
    reqQuery.new && regExp.test(String(reqQuery.new)) && (sortOptions.push(["createdAt", 1]))

    let coupon_available = false;
    if (reqQuery.id) {
        const count = await PromoCode.countDocuments({ soft_delete: false, is_active: true, grounds: { $in: [reqQuery.id] } });
        if (count != 0) coupon_available = true;
    }

    if(where.is_popular) {
        const count = await Ground.countDocuments(where);
        if(count <= 3){
            delete where.is_popular;
        }
    }

    const grounds = (await Ground.find(where)
        .skip(Number(reqQuery.offset || 0))
        .limit(Number(reqQuery.limit || 10000))
        .sort(sortOptions)
        .populate({ path: 'venue', select: ['name', 'address', 'geo_location'], options: { strictPopulate: true } })
        .populate({ path: 'city', select: 'name', options: { strictPopulate: true } })
        .populate({ path: 'supported_sports', select: 'name', options: { strictPopulate: false } })
    ).map((ground) => {
        return {
            id: ground._id,
            venue: ground.venue,
            name: ground.name,
            dimensions: ground.dimensions,
            supported_sports: ground.supported_sports,
            rules: ground.rules,
            ground_type: ground.ground_type,
            city: ground.city,
            images: ground.images,
            video: ground.video,
            amenities: ground.amenities,
            coupon_available,
            is_popular: ground.is_popular
        }
    });

    const count = await Ground.countDocuments(where);

    const response = response200("", { count, grounds });
    return res.status(response[0]).json(response[1]);
}));

export default router;