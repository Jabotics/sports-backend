import sharp from "sharp";
import { CustomRequest } from "../server";
import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { Request, Response, Router } from "express";
import { GroundType, IAcademy } from "../types/types";
import verifyJWT from "../middlewares/authentication";
import { FilterQuery, SortOrder, Types } from "mongoose";
import { add, menus, remove, update, view } from "../middlewares/permission";
import { validateArrayData, validateObjectData } from "../lib/helpers/validation";
import { Academy, City, Ground, Membership, SlotTime, Sport, Venue } from "../schemas/schema";
import { checkGroundSlotTime, findFile, removeMultipleFiles, response200, saveImage, uploadPaths } from "../lib/helpers/utils";
import { add_academy_schema, get_academy_schema, remove_academy_schema, update_academy_image_schema, update_academy_schema } from "../validation/academyValidation";

interface AcademyQuery extends FilterQuery<IAcademy> {
    $or?: Array<{ [key: string]: any }>;
    is_active?: {
        $in: Array<Boolean>;
    };
    ground?: {
        $in: Array<Types.ObjectId>;
    };
    venue?: {
        $in: Array<Types.ObjectId>;
    };
    city?: Types.ObjectId;
    sport?: Types.ObjectId;
}

const router = Router();

interface academy_data  {
    name?: string;
    city?: string;
    venue?: string;
    sport?: string;
    video?: string;
    ground?: string;
    slots?: string[];
    yearly_fee?: number;
    active_days?: string[];
    description?: string;
    monthly_fee?: number;
    admission_fee?: number;
    quarterly_fee?: number;
    half_yearly_fee?: number;
    images?: string[];
    is_active?: boolean;   
    max_buffer_days?: number; 
}

//For authenticated employees with permission
router.post('/add-academy',[verifyJWT, add(menus.Academies)] ,asyncHandler(async (req: CustomRequest, res: Response) => {
    let reqData = req.body;
    reqData = {
        ...reqData, 
        slots: JSON.parse(reqData.slots),
        active_days: JSON.parse(reqData.active_days),
    }
    const user = req.user;
    const reqFiles = req.files;    

    if (!user) throw new CustomError("Permission denied", 403);

    let slotTimes = [];
    if (reqData.slots.morning.length != 0 && reqData.slots.evening.length == 0) {
        slotTimes = reqData.slots.morning;
    }
    else if(reqData.slots.evening.length != 0 && reqData.slots.morning.length == 0) {        
        slotTimes = reqData.slots.evening;
    }
    else if(reqData.slots.morning.length != 0 && reqData.slots.evening.length != 0) {        
        slotTimes = reqData.slots.morning.concat(reqData.slots.evening);
    }
    else {
        throw new CustomError("Slot time for morning or evening is required", 406);
    }

    //Data validation
    const validation = validateObjectData(add_academy_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    //File/image validation
    if (Array.isArray(reqFiles) && reqFiles?.length != 0) {
        const imgValidation = validateArrayData(update_academy_image_schema, reqFiles);
        if (imgValidation.error) throw new CustomError(imgValidation.error.message, 406, imgValidation.error.details[0].context?.key);
    }
    //Checking active city
    const city = await City.findOne({ _id: reqData.city, is_active: true, soft_delete: false });
    if (!city) throw new CustomError("City does not exist or is disabled", 406);
    
    //Checking active venue
    const venue = await Venue.findOne({ _id: reqData.venue, is_active: true, soft_delete: false });
    if (!venue) throw new CustomError("Venue does not exist or is disabled", 406);
    
    //Checking active ground and supported academy by the ground
    const ground = await Ground.findOne({ _id: reqData.ground, is_active: true, soft_delete: false });
    if (!ground) throw new CustomError("Ground does not exist or is disabled", 406);
    if (!ground.academy) throw new CustomError("This ground does not support academy", 406);
    
    //Checking active sports and sports supported by the ground or not
    const sport = await Sport.countDocuments({ _id: reqData.sport, is_active: true, soft_delete: false });
    if (sport == 0) throw new CustomError("Sport does not exist or is disabled", 406);
    if (!ground.supported_sports?.includes(reqData.sport)) throw new CustomError("Ground does not support the sport you selected", 406);
    
    //Checking active time slots for the ground
    const slots = await SlotTime.find({ _id: { $in: slotTimes }, is_active: true, soft_delete: false });
    if (slots.length == 0) throw new CustomError("Slot does not exist or is disabled", 406);
    if (!checkGroundSlotTime(reqData.ground, slots)) throw new CustomError("Ground does not have the slots you selected", 406);
    
    //Checking existing academy
    const checkExisting = await Academy.find({ ground: reqData.ground, soft_delete: false });
    if (checkExisting.length != 0) {
        if (checkExisting[0].name == reqData.name) throw new CustomError("Academy name already exists for this ground", 406);
    }
    
    //checking ground exists in the venue or not
    if (ground.venue != reqData.venue) throw new CustomError("The venue doesn't have the ground you selected", 406);
    
    //Checking the user permission for ground and venue
    if ('venue' in user && Array.isArray(user.venue) && user.venue.length != 0 && !user.venue.includes(reqData.venue)) throw new CustomError("Permission denied", 403);
    if ('ground' in user && Array.isArray(user.ground) && user.ground.length != 0 && !user.ground.includes(reqData.ground)) throw new CustomError("Permission denied", 403);
    
    const bookedAcademySlot = (await Academy.find({ ground: reqData.ground, soft_delete: false, is_active: true })).map((academy) => academy.slots);
    const allBookedAcademySlots = bookedAcademySlot.length > 0 ? bookedAcademySlot.flatMap(entry => [...entry.morning, ...entry.evening]) : [];    
    const bookedMembershipSlot = (await Membership.find({ ground: reqData.ground, soft_delete: false, is_active: true })).map((membership) => membership.slots);
    const allBookedMembershipSlots = bookedMembershipSlot.length > 0 ? bookedMembershipSlot.flatMap(entry => [...entry.morning, ...entry.evening]) : [];    
    
    let mergedArray = allBookedAcademySlots.concat(allBookedMembershipSlots);
    let uniqueIds = [...new Set(mergedArray.flat())];
              
    let morningSlotsObjectId = reqData.slots.morning.length != 0 ? reqData.slots.morning.map((id: any) => new Types.ObjectId(String(id))) : [];    
    let eveningSlotsObjectId = reqData.slots.evening.length != 0 ? reqData.slots.evening.map((id: any) => new Types.ObjectId(String(id))) : [];
    const allSlotsObjectId = morningSlotsObjectId.concat(eveningSlotsObjectId);    
    
    let matchSlots = allSlotsObjectId.some((id: Types.ObjectId) => uniqueIds.some((objId: Types.ObjectId) => id.equals(objId)));    

    if (matchSlots) throw new CustomError("Slot already reserved", 406);

    const data = {
        name: reqData.name,
        city: reqData.city,
        venue: reqData.venue,
        slots: reqData.slots,
        sport: reqData.sport,
        video: reqData?.video,
        ground: reqData.ground,
        yearly_fee: reqData?.yearly_fee,
        active_days: reqData.active_days,
        description: reqData?.description,
        monthly_fee: reqData?.monthly_fee,
        admission_fee: reqData.admission_fee,
        quarterly_fee: reqData?.quarterly_fee,
        max_buffer_days: reqData?.max_buffer_days,
        half_yearly_fee: reqData?.half_yearly_fee,
    }

    const academy = await Academy.create(data);

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
            await saveImage(uploadPaths.academies, `${academy._id}-${reqFiles[i].originalname}`, compressedBuffer);
        }
    }
    let url = await findFile(academy._id, uploadPaths.academies);

    await Academy.updateOne(
        { _id: academy._id, },
        { $set: { images: url } }
    );
    
    const response = response200("Academy created successfully", { id: academy._id });
    return res.status(response[0]).json(response[1]);
}));

router.get('/get-academies', [verifyJWT, view(menus.Academies)] ,asyncHandler(async (req: CustomRequest, res: Response) => {
    let reqQuery = req.query;
    reqQuery = {
        ...reqQuery,
        is_active: req.query.is_active && JSON.parse(String(reqQuery.is_active))
    }
    const user = req.user;

    if (!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(get_academy_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: AcademyQuery = {
        soft_delete: false,
    }

    var regExp = new RegExp("true");
    if (reqQuery.is_active && Array.isArray(reqQuery.is_active) && reqQuery.is_active.length != 0) {
        const active_status = reqQuery.is_active.map((status) => {
            return regExp.test(String(status));
        });
        where.is_active = { $in: active_status }
    }
    reqQuery.sport && (where.sport = new Types.ObjectId(String(reqQuery.sport)));
    reqQuery.search && (where.$or = [
        { name: { $regex: String(reqQuery.search), $options: 'i' } },
    ]);
    if (reqQuery.ground && Array.isArray(reqQuery.ground) && reqQuery.ground.length != 0) {
        const groundIds = reqQuery.ground.map((id) => {
            return new Types.ObjectId(String(id));
        });
        where.ground = { $in: groundIds }
    }

    if ('ground' in user && Array.isArray(user.ground) && user.ground.length != 0) {
        const groundIds = user.ground.map((id) => {
            return new Types.ObjectId(String(id));
        });
        where.ground = { $in: groundIds }
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

    const academies = (await Academy.find(where)
        .populate({
            path: 'ground',
            select: ['name', '_id'],
            options: { strictPopulate: false },
            populate: venuePopulateOptions
        })
        .populate({ path: 'slots.morning', select: ['slot', '_id'], options: { strictPopulate: false } })
        .populate({ path: 'slots.evening', select: ['slot', '_id'], options: { strictPopulate: false } })
        .populate({ path: 'sport', select: ['name', '_id'], options: { strictPopulate: false } })
        .sort(sortOptions)
        .skip(Number(reqQuery.offset))
        .limit(Number(reqQuery.limit))
    ).map((academy) => {
        return {
            id: academy._id,
            name: academy.name,
            admission_fees: academy.admission_fee,
            monthly_fee: academy.monthly_fee,
            quarterly_fee: academy.quarterly_fee,
            half_yearly_fee: academy.half_yearly_fee,
            yearly_fee: academy.yearly_fee,
            ground: academy.ground,
            sport: academy.sport,
            slots: academy.slots,
            is_active: academy.is_active,
            active_days: academy.active_days,
            images: academy.images,
            description: academy.description,
            video: academy.video,
            max_buffer_days: academy.max_buffer_days
        }
    });

    const count = await Academy.countDocuments(where);

    const response = response200("Academies fetched successfully", { count, academies });
    return res.status(response[0]).json(response[1]);
}));

router.post('/update-academy', [verifyJWT, update(menus.Academies)], asyncHandler(async (req: CustomRequest, res: Response) => {
    let reqData = req.body;
    reqData = {
        ...reqData,
        slots: reqData.slots && JSON.parse(reqData.slots),
        deleted_files: reqData.deleted_files && JSON.parse(reqData.deleted_files),
        active_days: reqData.active_days && JSON.parse(reqData.active_days)
    }
    const user = req.user;
    const reqFiles = req.files;

    if (!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(update_academy_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if (Array.isArray(reqFiles) && reqFiles?.length != 0) {
        const imgValidation = validateArrayData(update_academy_image_schema, reqFiles);
        if (imgValidation.error) throw new CustomError(imgValidation.error.message, 406, imgValidation.error.details[0].context?.key);
    }

    const academy = await Academy.findOne({ _id: reqData.id });
    if (!academy) throw new CustomError("Academy does not exist", 406);

    if (reqData.venue) {
        const venue = await Venue.findOne({ _id: reqData.venue, is_active: true, soft_delete: false });
        if (!venue) throw new CustomError("Venue does not exist or is disabled", 406);
    }

    if (reqData.ground) {
        const ground = await Ground.findOne({ _id: reqData.ground, is_active: true, soft_delete: false });
        if (!ground) throw new CustomError("Ground does not exist or is disabled", 406);
        if (!ground.academy) throw new CustomError("Ground does not support academy", 406);
    }
    if (reqData.slotTimes && !reqData.ground) {
        const slots = await SlotTime.find({ _id: { $in: reqData.slotTimes }, is_active: true, soft_delete: false });
        if (slots.length == 0) throw new CustomError("Slot does not exist or is disabled", 406);
        if (!checkGroundSlotTime(academy.ground, slots)) throw new CustomError("Ground does not support the slot you selected", 406);
    }
    if (reqData.slotTimes && reqData.ground) {
        const slots = await SlotTime.find({ _id: { $in: reqData.slotTimes }, is_active: true, soft_delete: false });
        if (slots.length == 0) throw new CustomError("Slot does not exist or is disabled", 406);
        if (!checkGroundSlotTime(reqData.ground, slots)) throw new CustomError("Ground does not support the slot you selected", 406);
    }

    if (reqData.ground) {
        if ('ground' in user && Array.isArray(user.ground) && user.ground.length != 0 && !user.ground.includes(reqData.ground)) throw new CustomError("Permission denied", 403);
    }

    const ground = await Ground.findOne({ _id: reqData.ground ? reqData.ground : academy.ground, soft_delete: false, is_active: true });

    if (reqData.sport && !reqData.ground) {
        const sport = await Sport.countDocuments({ _id: reqData.sport, is_active: true, soft_delete: false });
        if (sport == 0) throw new CustomError("Sport does not exist or is disabled", 406);
        if (ground && !ground.supported_sports?.includes(reqData.sport)) throw new CustomError("Ground does not support the sport you selected", 406);
    }
    if (reqData.sport && reqData.ground) {
        const sport = await Sport.countDocuments({ _id: reqData.sport, is_active: true, soft_delete: false });
        if (sport == 0) throw new CustomError("Sport does not exist or is disabled", 406);
        if (ground && !ground.supported_sports?.includes(reqData.sport)) throw new CustomError("Ground does not support the sport you selected", 406);
    }

    if (reqData.slots && Array.isArray(reqData.slots)) {        
        const bookedAcademySlot = (await Academy.find({ _id: { $ne: reqData.id }, soft_delete: false, is_active: true })).map((academy) => academy.slots);
        const allBookedAcademySlots = bookedAcademySlot.length > 0 ? bookedAcademySlot.flatMap(entry => [...entry.morning, ...entry.evening]) : [];
        const bookedMembershipSlot = (await Membership.find({ _id: { $ne: reqData.id }, soft_delete: false, is_active: true })).map((membership) => membership.slots);
        const allBookedMembershipSlots = bookedMembershipSlot.length > 0 ? bookedMembershipSlot.flatMap(entry => [...entry.morning, ...entry.evening]) : [];

        let mergedArray = allBookedAcademySlots.concat(allBookedMembershipSlots);
        let uniqueIds = [...new Set(mergedArray.flat())];

        let morningSlotsObjectId = reqData.slots.morning.length != 0 ? reqData.slots.morning.map((id: any) => new Types.ObjectId(String(id))) : [];    
        let eveningSlotsObjectId = reqData.slots.evening.length != 0 ? reqData.slots.evening.map((id: any) => new Types.ObjectId(String(id))) : [];
        const allSlotsObjectId = morningSlotsObjectId.concat(eveningSlotsObjectId);    
        
        let matchSlots = allSlotsObjectId.some((id: Types.ObjectId) => uniqueIds.some((objId: Types.ObjectId) => id.equals(objId)));    
    
        if (matchSlots) throw new CustomError("Slot already reserved", 406);
    }

    const data: academy_data = {
        name: reqData?.name,
        ground: reqData?.ground,
        sport: reqData?.sport,
        slots: reqData?.slots,
        admission_fee: reqData.admission_fee,
        monthly_fee: reqData?.monthly_fee,
        quarterly_fee: reqData?.quarterly_fee,
        half_yearly_fee: reqData?.half_yearly_fee,
        yearly_fee: reqData?.yearly_fee,
        is_active: reqData?.is_active,
        active_days: reqData?.active_days,
        description: reqData?.description,
        video: reqData?.video,
        max_buffer_days: reqData?.max_buffer_days
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
            await saveImage(uploadPaths.academies, `${academy._id}-${reqFiles[i].originalname}`, compressedBuffer);            
        }
    }
    let imageUrl = await findFile(reqData.id, uploadPaths.academies);
    data.images = imageUrl;

    await Academy.findByIdAndUpdate(
        { _id: reqData.id },
        { $set: data }
    );

    const response = response200("Academy updated successfully", {});
    return res.status(response[0]).json(response[1]);
}));

router.post('/remove-academies', [verifyJWT, remove(menus.Academies)], asyncHandler(async (req: Request, res: Response) => {
    const reqIds = req.body.academyIds;

    const validation = validateArrayData(remove_academy_schema, reqIds);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    await Academy.updateMany(
        { _id: { $in: reqIds } },
        { $set: { soft_delete: true } },
    );

    const response = response200("Academy removed successfully", {});
    return res.status(response[0]).json(response[1]);
}));

//For all Employees
router.get('/fetch-academies', verifyJWT, asyncHandler(async (req: CustomRequest, res: Response) => {
    let reqQuery = req.query;
    reqQuery = {
        ...reqQuery,
        is_active: req.query.is_active && JSON.parse(String(reqQuery.is_active)),
        venue: reqQuery.venue && JSON.parse(String(reqQuery.venue)),
        ground: reqQuery.ground && JSON.parse(String(reqQuery.ground))
    };
    const user = req.user;

    if (!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(get_academy_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: AcademyQuery = {
        soft_delete: false,
        is_active: {
            $in: [true]
        }
    }

    'city' in user && user.city && (where.city = new Types.ObjectId(String(user.city._id)));
    if ('ground' in user && Array.isArray(user.ground) && user.ground.length != 0) {
        const groundIds = user.ground.map((id) => {
            return new Types.ObjectId(String(id));
        });
        where.ground = { $in: groundIds }
    }

    if ('venue' in user && Array.isArray(user.venue) && user.venue.length != 0) {
        const venueIds = user.venue.map((id) => {
            return new Types.ObjectId(String(id));
        });
        where.venue = { $in: venueIds }
    }

    if (reqQuery.ground_type) {
        const query = {
            ground_type: reqQuery.ground_type == 'Indoor' ? GroundType.INDOOR : GroundType.OUTDOOR,
            soft_delete: false,
            is_active: true,
            city: reqQuery.city && String(reqQuery.city)
        }
        const groundIds = (await Ground.find(query)).map((ground) => {
            return ground._id
        })
        where.ground = { $in: groundIds }
    }

    reqQuery.city && (where.city = new Types.ObjectId(String(reqQuery.city)));
    var regExp = new RegExp("true");
    if (reqQuery.is_active && Array.isArray(reqQuery.is_active) && reqQuery.is_active.length != 0) {
        const active_status = reqQuery.is_active.map((status) => {
            return regExp.test(String(status));
        });
        where.is_active = { $in: active_status }
    }
    reqQuery.sport && (where.sport = new Types.ObjectId(String(reqQuery.sport)));
    reqQuery.search && (where.$or = [
        { name: { $regex: String(reqQuery.search), $options: 'i' } },
    ]);
    if (reqQuery.ground && Array.isArray(reqQuery.ground) && reqQuery.ground.length != 0) {
        const groundIds = reqQuery.ground.map((id) => {
            return new Types.ObjectId(String(id));
        });
        where.ground = { $in: groundIds }
    }

    if (reqQuery.venue && Array.isArray(reqQuery.venue) && reqQuery.venue.length != 0) {
        const venueIds = reqQuery.venue.map((id) => {
            return new Types.ObjectId(String(id));
        });
        where.venue = { $in: venueIds }
    }

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

    const academies = (await Academy.find(where)
        .populate({
            path: 'ground',
            select: ['name', '_id', 'ground_type'],
            options: { strictPopulate: false },
            populate: venuePopulateOptions
        })
        .populate({ path: 'slotTimes', select: ['slot', '_id'], options: { strictPopulate: false } })
        .populate({ path: 'sport', select: ['name', '_id'], options: { strictPopulate: false } })
        .sort(sortOptions)
        .skip(Number(reqQuery.offset))
        .limit(Number(reqQuery.limit))
    ).map((academy) => {
        return {
            id: academy._id,
            name: academy.name,
            monthly_fee: academy.monthly_fee,
            quarterly_fee: academy.quarterly_fee,
            half_yearly_fee: academy.half_yearly_fee,
            yearly_fee: academy.yearly_fee,
            admission_fees: academy.admission_fee,
            ground: academy.ground,
            sport: academy.sport,
            slots: academy.slots,
            active_days: academy.active_days
        }
    });

    const count = await Academy.countDocuments(where);

    const response = response200("Academies fetched successfully", { count, academies });
    return res.status(response[0]).json(response[1]);
}));

//For user side
router.get('/academies', asyncHandler(async (req: Request, res: Response) => {
    let reqQuery = req.query;
    reqQuery = {
        ...reqQuery,
        is_active: req.query.is_active && JSON.parse(String(reqQuery.is_active)),
        venue: reqQuery.venue && JSON.parse(String(reqQuery.venue)),
        ground: reqQuery.ground && JSON.parse(String(reqQuery.ground))
    }

    const validation = validateObjectData(get_academy_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: AcademyQuery = {
        soft_delete: false,
        is_active: {
            $in: [true]
        }
    }

    if (reqQuery.ground_type) {
        const query = {
            ground_type: reqQuery.ground_type == 'Indoor' ? GroundType.INDOOR : GroundType.OUTDOOR,
            soft_delete: false,
            is_active: true,
            city: reqQuery.city && String(reqQuery.city)
        }
        const groundIds = (await Ground.find(query)).map((ground) => {
            return ground._id
        })
        where.ground = { $in: groundIds }
    }

    reqQuery.city && (where.city = new Types.ObjectId(String(reqQuery.city)));
    reqQuery.sport && (where.sport = new Types.ObjectId(String(reqQuery.sport)));
    reqQuery.search && (where.$or = [
        { name: { $regex: String(reqQuery.search), $options: 'i' } },
    ]);
    if (reqQuery.ground && Array.isArray(reqQuery.ground) && reqQuery.ground.length != 0) {
        const groundIds = reqQuery.ground.map((id) => {
            return new Types.ObjectId(String(id));
        });
        where.ground = { $in: groundIds }
    }

    if (reqQuery.venue && Array.isArray(reqQuery.venue) && reqQuery.venue.length != 0) {
        const venueIds = reqQuery.venue.map((id) => {
            return new Types.ObjectId(String(id));
        });
        where.venue = { $in: venueIds }
    }

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

    const academies = (await Academy.find(where)
        .populate({
            path: 'ground',
            select: ['name', '_id', 'ground_type'],
            options: { strictPopulate: false },
            populate: venuePopulateOptions
        })
        .populate({ path: 'slots.morning', select: ['slot', '_id'], options: { strictPopulate: false } })
        .populate({ path: 'slots.evening', select: ['slot', '_id'], options: { strictPopulate: false } })
        .populate({ path: 'sport', select: ['name', '_id'], options: { strictPopulate: false } })
        .sort(sortOptions)
        .skip(Number(reqQuery.offset))
        .limit(Number(reqQuery.limit))
    ).map((academy) => {
        return {
            id: academy._id,
            name: academy.name,
            admission_fees: academy.admission_fee,
            monthly_fee: academy.monthly_fee,
            quarterly_fee: academy.quarterly_fee,
            half_yearly_fee: academy.half_yearly_fee,
            yearly_fee: academy.yearly_fee,
            ground: academy.ground,
            sport: academy.sport,
            slots: academy.slots,
            active_days: academy.active_days,
            description: academy.description,
            images: academy.images,
            video: academy.video
        }
    });

    const count = await Academy.countDocuments(where);

    const response = response200("", { count, academies });
    return res.status(response[0]).json(response[1]);
}));

export default router;