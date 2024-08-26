import { CustomRequest } from "../server";
import { IMembership } from "../types/types";
import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { Request, Response, Router } from "express";
import verifyJWT from "../middlewares/authentication";
import { FilterQuery, SortOrder, Types } from "mongoose";
import { checkGroundSlotTime, response200 } from "../lib/helpers/utils";
import { add, menus, remove, update, view } from "../middlewares/permission";
import { validateArrayData, validateObjectData } from "../lib/helpers/validation";
import { Academy, City, Ground, Membership, SlotTime, Sport, Venue } from "../schemas/schema";
import { add_membership_schema, get_membership_schema, remove_membership_schema, update_membership_schema } from "../validation/membershipValidation";

interface MembershipQuery extends FilterQuery<IMembership> {
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
    _id?: Types.ObjectId;
}

const router = Router();

//For authenticated employees with permission
router.post('/add-membership', [verifyJWT, add(menus.Memberships)] ,asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqData = req.body;
    const user = req.user;

    if (!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(add_membership_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

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

    const city = await City.countDocuments({ _id: reqData.city, is_active: true, soft_delete: false });
    if (city == 0) throw new CustomError("City does not exist or is disabled", 406);

    const venue = await Venue.countDocuments({ _id: reqData.venue, is_active: true, soft_delete: false });
    if (venue == 0) throw new CustomError("Venue does not exist or is disabled", 406);

    const ground = await Ground.findOne({ _id: reqData.ground, is_active: true, soft_delete: false });
    if (!ground) throw new CustomError("Ground does not exist or is disabled", 406);
    if (!ground.membership) throw new CustomError("This ground does not support membership", 406);

    const sport = await Sport.countDocuments({ _id: reqData.sport, is_active: true, soft_delete: false });
    if (sport == 0) throw new CustomError("Sport does not exist or is disabled", 406);
    if (!ground.supported_sports?.includes(reqData.sport)) throw new CustomError("Ground does not support the sport you selected", 406);


    const slots = await SlotTime.find({ _id: { $in: slotTimes }, is_active: true, soft_delete: false });
    if (slots.length == 0) throw new CustomError("Slot does not exist or is disabled", 406);
    if (!checkGroundSlotTime(reqData.ground, slots)) throw new CustomError("Ground does not have the slots you selected", 406);

    if (ground.venue != reqData.venue) throw new CustomError("The venue doesn't have the ground you selected", 406);

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
        city: reqData.city,
        slots: reqData.slots,
        venue: reqData.venue,
        sport: reqData.sport,
        ground: reqData.ground,
        yearly_fee: reqData?.yearly_fee,
        monthly_fee: reqData?.monthly_fee,
        admission_fee: reqData.admission_fee,
        quarterly_fee: reqData?.quarterly_fee,
        max_buffer_days: reqData?.max_buffer_days,
        half_yearly_fee: reqData?.half_yearly_fee,
    }    

    const membership = await Membership.create(data);

    const response = response200("Membership created successfully", { id: membership._id });
    return res.status(response[0]).json(response[1]);
}));

router.get('/get-memberships', [verifyJWT, view(menus.Memberships)], asyncHandler(async (req: CustomRequest, res: Response) => {
    let reqQuery = req.query;
    reqQuery = {
        ...reqQuery,
        is_active: req.query.is_active && JSON.parse(String(reqQuery.is_active)),
    }
    const user = req.user;

    if (!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(get_membership_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: MembershipQuery = {
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
    reqQuery.id && (where._id = new Types.ObjectId(String(reqQuery.id)));

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

    if ('city' in user && user.city) {
        where.city = user.city._id;
    }

    const sortOptions: string | { [key: string]: SortOrder | { $meta: any; }; } | [string, SortOrder][] | null | undefined = [];
    if (reqQuery.orderBy) {
        sortOptions.push([String(reqQuery.orderBy), reqQuery.sort === 'asc' ? 1 : -1]);
    } else {
        sortOptions.push(["createdAt", 1]);
    }

    const memberships = (await Membership.find(where)
        .populate({
            path: 'ground',
            select: ['name', '_id'],
            options: { strictPopulate: false },
            populate: {
                path: 'venue',
                select: 'name',
                options: { strictPopulate: false }
            }
        })
        .populate({ path: 'slots.morning', select: ['slot', '_id'], options: { strictPopulate: false } })
        .populate({ path: 'slots.evening', select: ['slot', '_id'], options: { strictPopulate: false } })
        .populate({ path: 'sport', select: ['name', '_id'], options: { strictPopulate: false } })
        .sort(sortOptions)
        .skip(Number(reqQuery.offset))
        .limit(Number(reqQuery.limit))
    ).map((membership) => {
        return {
            id: membership._id,
            fees: membership.fees,
            ground: membership.ground,
            sport: membership.sport,
            slots: membership.slots,
            admission_fee: membership.admission_fee,
            monthly_fee: membership.monthly_fee,
            quarterly_fee: membership.quarterly_fee,
            half_yearly_fee: membership.half_yearly_fee,
            yearly_fee: membership.yearly_fee,
            max_buffer_days: membership.max_buffer_days,
            is_active: membership.is_active,
        }
    });

    const count = await Membership.countDocuments(where);

    const response = response200("Memberships fetched successfully", { count, memberships });
    return res.status(response[0]).json(response[1]);
}));

router.post('/update-membership', [verifyJWT, update(menus.Memberships)], asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqData = req.body;
    const user = req.user;

    if (!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(update_membership_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const membership = await Membership.findOne({ _id: reqData.id });
    if (!membership) throw new CustomError("Membership does not exist", 406);

    if (reqData.venue) {
        const venue = await Venue.countDocuments({ _id: reqData.venue, is_active: true, soft_delete: false });
        if (venue == 0) throw new CustomError("Venue does not exist or is disabled", 406);
    }

    if (reqData.ground) {
        const ground = await Ground.findOne({ _id: reqData.ground, is_active: true, soft_delete: false });
        if (!ground) throw new CustomError("Ground does not exist or is disabled", 406);
        if (!ground.membership) throw new CustomError("Ground does not support membership", 406);
    }
    if (reqData.slotTimes && !reqData.ground) {
        const slots = await SlotTime.find({ _id: { $in: reqData.slotTimes }, is_active: true, soft_delete: false });
        if (slots.length == 0) throw new CustomError("Slot does not exist or is disabled", 406);
        if (!checkGroundSlotTime(membership.ground, slots)) throw new CustomError("Ground does not support the slot you selected", 406);
    }
    if (reqData.slotTimes && reqData.ground) {
        const slots = await SlotTime.find({ _id: { $in: reqData.slotTimes }, is_active: true, soft_delete: false });
        if (slots.length == 0) throw new CustomError("Slot does not exist or is disabled", 406);
        if (!checkGroundSlotTime(reqData.ground, slots)) throw new CustomError("Ground does not support the slot you selected", 406);
    }

    if (reqData.ground) {
        if ('ground' in user && Array.isArray(user.ground) && user.ground.length != 0 && !user.ground.includes(reqData.ground)) throw new CustomError("Permission denied", 403);
    }

    const ground = await Ground.findOne({ _id: reqData.ground ? reqData.ground : membership.ground, soft_delete: false, is_active: true });

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

    if (reqData.slotTimes && Array.isArray(reqData.slotTimes)) {
        const bookedAcademySlot = (await Academy.find({ _id: { $ne: reqData.id }, soft_delete: false, is_active: true })).map((academy) => academy.slots);
        const allAcademyBookedSlots = bookedAcademySlot.length > 0 ? bookedAcademySlot.flatMap(entry => [...entry.morning, ...entry.evening]) : [];
        const bookedMembershipSlot = (await Membership.find({ _id: { $ne: reqData.id }, soft_delete: false, is_active: true })).map((membership) => membership.slots);
        const allMembershipBookedSlots = bookedMembershipSlot.length > 0 ? bookedMembershipSlot.flatMap(entry => [...entry.morning, ...entry.evening]) : [];

        let mergedArray = allAcademyBookedSlots.concat(allMembershipBookedSlots);
        let uniqueIds = [...new Set(mergedArray.flat())];

        let morningSlotsObjectId = reqData.slots.morning.length != 0 ? reqData.slots.morning.map((id: any) => new Types.ObjectId(String(id))) : [];
        let eveningSlotsObjectId = reqData.slots.evening.length != 0 ? reqData.slots.evening.map((id: any) => new Types.ObjectId(String(id))) : [];
        const allSlotsObjectId = morningSlotsObjectId.concat(eveningSlotsObjectId);

        let matchSlots = allSlotsObjectId.some((id: Types.ObjectId) => uniqueIds.some((objId: Types.ObjectId) => id.equals(objId)));

        if (matchSlots) throw new CustomError("Slot already reserved", 406);
    }

    const data = {
        sport: reqData?.sport,
        ground: reqData?.ground,
        slotTimes: reqData?.slotTimes,
        is_active: reqData?.is_active,
        yearly_fee: reqData?.yearly_fee,
        monthly_fee: reqData?.monthly_fee,
        admission_fee: reqData?.admission_fee,
        quarterly_fee: reqData?.quarterly_fee,
        max_buffer_days: reqData?.max_buffer_days,
        half_yearly_fee: reqData?.half_yearly_fee,
    }

    await Membership.findByIdAndUpdate(
        { _id: reqData.id },
        { $set: data }
    );

    const response = response200("Membership updated successfully", {});
    return res.status(response[0]).json(response[1]);
}));

router.post('/remove-memberships', [verifyJWT, remove(menus.Memberships)], asyncHandler(async (req: Request, res: Response) => {
    const reqIds = req.body.membershipIds;

    const validation = validateArrayData(remove_membership_schema, reqIds);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    await Membership.updateMany(
        { _id: { $in: reqIds } },
        { $set: { soft_delete: true } },
    );

    const response = response200("Membership removed successfully", {});
    return res.status(response[0]).json(response[1]);
}));


//For all Employees
router.get('/fetch-memberships', verifyJWT, asyncHandler(async (req: CustomRequest, res: Response) => {
    let reqQuery = req.query;
    reqQuery = {
        ...reqQuery,
        is_active: req.query.is_active && JSON.parse(String(reqQuery.is_active)),
        ground: req.query.ground && JSON.parse(String(reqQuery.ground)),
        venue: req.query.venue && JSON.parse(String(reqQuery.venue))
    }
    const user = req.user;

    if (!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(get_membership_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: MembershipQuery = {
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
    reqQuery.id && (where._id = new Types.ObjectId(String(reqQuery.id)));

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
    'city' in user && user.city && (where.city = user.city._id);

    const sortOptions: string | { [key: string]: SortOrder | { $meta: any; }; } | [string, SortOrder][] | null | undefined = [];
    if (reqQuery.orderBy) {
        sortOptions.push([String(reqQuery.orderBy), reqQuery.sort === 'asc' ? 1 : -1]);
    } else {
        sortOptions.push(["createdAt", 1]);
    }

    const memberships = (await Membership.find(where)
        .populate({
            path: 'ground',
            select: ['name', '_id'],
            options: { strictPopulate: false },
            populate: {
                path: 'venue',
                select: 'name',
                options: { strictPopulate: false }
            }
        })
        .populate({ path: 'slot.morning', select: ['slot', '_id'], options: { strictPopulate: false } })
        .populate({ path: 'slot.evening', select: ['slot', '_id'], options: { strictPopulate: false } })
        .populate({ path: 'sport', select: ['name', '_id'], options: { strictPopulate: false } })
        .sort(sortOptions)
        .skip(Number(reqQuery.offset))
        .limit(Number(reqQuery.limit))
    ).map((membership) => {
        return {
            id: membership._id,
            fees: membership.fees,
            ground: membership.ground,
            sport: membership.sport,
            slots: membership.slots,
            admission_fee: membership.admission_fee,
            monthly_fee: membership.monthly_fee,
            quarterly_fee: membership.quarterly_fee,
            half_yearly_fee: membership.half_yearly_fee,
            yearly_fee: membership.yearly_fee,
        }
    });

    const count = await Membership.countDocuments(where);

    const response = response200("Memberships fetched successfully", { count, memberships });
    return res.status(response[0]).json(response[1]);
}));

//For User side
router.get('/memberships', asyncHandler(async (req: Request, res: Response) => {
    let reqQuery = req.query;
    reqQuery = {
        ...reqQuery,
        venue: reqQuery.venue && JSON.parse(String(reqQuery.venue))
    }

    const validation = validateObjectData(get_membership_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: MembershipQuery = {
        soft_delete: false,
        is_active: {
            $in: [true]
        }
    }

    reqQuery.sport && (where.sport = new Types.ObjectId(String(reqQuery.sport)));
    reqQuery.id && (where._id = new Types.ObjectId(String(reqQuery.id)));

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

    reqQuery.city && (where.city = new Types.ObjectId(String(reqQuery.city)));

    const sortOptions: string | { [key: string]: SortOrder | { $meta: any; }; } | [string, SortOrder][] | null | undefined = [];
    if (reqQuery.orderBy) {
        sortOptions.push([String(reqQuery.orderBy), reqQuery.sort === 'asc' ? 1 : -1]);
    } else {
        sortOptions.push(["createdAt", 1]);
    }

    const memberships = (await Membership.find(where)
        .populate({
            path: 'ground',
            select: ['name', '_id'],
            options: { strictPopulate: false },
            populate: {
                path: 'venue',
                select: 'name',
                options: { strictPopulate: false }
            }
        })
        .populate({ path: 'slots.morning', select: ['slot', '_id'], options: { strictPopulate: false } })
        .populate({ path: 'slots.evening', select: ['slot', '_id'], options: { strictPopulate: false } })
        .populate({ path: 'sport', select: ['name', '_id'], options: { strictPopulate: false } })
        .sort(sortOptions)
        .skip(Number(reqQuery.offset))
        .limit(Number(reqQuery.limit))
    ).map((membership) => {
        return {
            id: membership._id,
            fees: membership.fees,
            ground: membership.ground,
            sport: membership.sport,
            slots: membership.slots,
            admission_fee: membership.admission_fee,
            monthly_fee: membership.monthly_fee,
            quarterly_fee: membership.quarterly_fee,
            half_yearly_fee: membership.half_yearly_fee,
            yearly_fee: membership.yearly_fee,
        }
    });

    const count = await Membership.countDocuments(where);

    const response = response200("Memberships fetched successfully", { count, memberships });
    return res.status(response[0]).json(response[1]);
}));

export default router;