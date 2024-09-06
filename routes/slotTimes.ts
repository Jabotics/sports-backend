import { CustomRequest } from "../server";
import { FilterQuery, Types } from "mongoose";
import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { response200 } from "../lib/helpers/utils";
import { Request, Response, Router } from "express";
import verifyJWT from "../middlewares/authentication";
import { EventStatus, ISlotTime, SlotBookingStatus } from "../types/types";
import { add, menus, remove, update, view } from "../middlewares/permission";
import { validateArrayData, validateObjectData } from "../lib/helpers/validation";
import { Academy, City, Event, Ground, Membership, SlotBooking, SlotTime, Venue } from "../schemas/schema";
import { add_slot_time_schema, available_slots_for_event, get_available_slots_schema, get_slot_times_schema, remove_slot_time_schema, update_slot_time_schema } from "../validation/slotTimeValidation";

interface SlotTimeQuery extends FilterQuery<ISlotTime> {
    $or?: Array<{ [key: string]: any }>;
    is_active?: boolean;
    ground?: {
        $in: Array<Types.ObjectId>;
    };
    venue?: {
        $in: Array<Types.ObjectId>;
    };
    city?: Types.ObjectId;
    _id?: Types.ObjectId;
}

const router = Router();

router.post('/add-slot-time', [verifyJWT, add(menus.Slot_Times)], asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqData = req.body;
    const user = req.user;    

    if (!user) throw new CustomError("Permission denied", 403);
    if ('ground' in user && Array.isArray(user.ground) && user.ground.length != 0 && !user.ground.includes(reqData.ground)) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(add_slot_time_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const checkExisting = await SlotTime.findOne({ ground: reqData.ground, slot: reqData.slot, soft_delete: false });
    if (checkExisting) throw new CustomError("Slot already exists", 409);

    const ground = await Ground.findOne({ _id: reqData.ground, is_active: true, soft_delete: false });
    if (!ground) throw new CustomError("Ground does not exist or is disabled", 406);

    const venue = await Venue.findOne({ _id: reqData.venue, is_active: true, soft_delete: false });
    if (!venue) throw new CustomError("Venue does not exist or is disabled", 406);

    if (ground.venue != reqData.venue) throw new CustomError("The venue doesn't have the ground you selected", 406);
    if (venue.city != user.city._id) throw new CustomError("The city doesn't have the venue you selected", 406);
    
    const slot = await SlotTime.create({        
        slot: reqData.slot,
        city: user.city._id,
        venue: reqData.venue,
        price: reqData.price,
        ground: reqData.ground,
    });

    const response = response200("Slot added successfully", { id: slot._id });
    return res.status(response[0]).json(response[1]);
}));

router.get('/get-slot-times', [verifyJWT, view(menus.Slot_Times)], asyncHandler(async (req: CustomRequest, res: Response) => {
    let reqQuery = req.query;
    reqQuery = { ...reqQuery, ground: reqQuery.ground && JSON.parse(String(reqQuery.ground)) }
    const user = req.user;

    if (!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(get_slot_times_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: SlotTimeQuery = {
        soft_delete: false
    }

    if (reqQuery.search) {
        where.$or = [
            { slot: { $regex: String(reqQuery.search), $options: 'i' } },
        ];
    }
    var regExp = new RegExp("true");
    reqQuery.is_active && (where.is_active = regExp.test(String(reqQuery.is_active)));
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

    if (user && 'city' in user && user.city) {
        where.city = user.city._id;
    }

    const venuePopulateOptions = {
        path: 'venue',
        select: 'name',
        options: { strictPopulate: false }
    }

    const slots = (await SlotTime.find(where)
        .populate({
            path: 'ground',
            select: 'name',
            populate: venuePopulateOptions,
            options: { strictPopulate: false }
        })
        .skip(Number(reqQuery.offset))
        .limit(Number(reqQuery.limit))
        .lean()
    ).filter((slot) => slot.ground && typeof slot.ground == 'object' && 'venue' in slot.ground && slot.ground.venue !== null)
        .map((slot) => {
            return {
                id: slot._id,
                slot: slot.slot,
                price: slot.price,
                ground: slot.ground,
                is_active: slot.is_active
            }
        });

    const count = await SlotTime.countDocuments(where);

    const response = await response200("Slots fetched successfully", { count, slots });
    return res.status(response[0]).json(response[1]);
}));

router.post('/update-slot-time', [verifyJWT, update(menus.Slot_Times)], asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqData = req.body;
    const user = req.user;

    if (!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(update_slot_time_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if (reqData.ground) {
        const ground = await Ground.findOne({ _id: reqData.ground, is_active: true, soft_delete: false });
        if (!ground) throw new CustomError("Ground does not exist or is disabled", 406);
    }

    let date = new Date();

    date.setHours(0);
    date.setMinutes(0);
    date.setSeconds(0);
    date.setMilliseconds(0);

    const academyCount = await Academy.countDocuments({ ground: reqData.ground, slotTimes: reqData.id, soft_delete: false, is_active: true });
    const membershipCount = await Membership.countDocuments({ ground: reqData.ground, slotTimes: reqData.id, soft_delete: false, is_active: true });
    const eventCount = await Event.countDocuments({ grounds: reqData.ground, event_status: EventStatus.UPCOMING, soft_delete: false, is_active: true });
    const slotBookingCount = await SlotBooking.countDocuments({ date: { $gte: date }, soft_delete: false, booking_status: SlotBookingStatus.BOOKED, is_active: true });

    if (eventCount !== 0) throw new CustomError("The slot is used in event, please remove and try again", 406);
    if (academyCount !== 0) throw new CustomError("The slot is used in academy, please remove and try again", 406);
    if (membershipCount !== 0) throw new CustomError("The slot is used in membership, please remove and try again", 406);
    if (slotBookingCount !== 0) throw new CustomError("The slot is booked, please cancel the booking and try again", 406);

    if (reqData.ground) {
        if ('ground' in user && Array.isArray(user.ground) && user.ground.length != 0 && !user.ground.includes(reqData.ground)) throw new CustomError("Permission denied", 403);
    }

    const data = {
        slot: reqData?.slot,
        price: reqData?.price,
        ground: reqData?.ground,
        is_active: reqData.is_active,
    }

    await SlotTime.findByIdAndUpdate(
        { _id: reqData.id },
        { $set: data }
    );

    const response = response200("Slot time updated successfully", {});
    return res.status(response[0]).json(response[1]);
}));

router.post('/remove-slot-times', [verifyJWT, remove(menus.Slot_Times)], asyncHandler(async (req: Request, res: Response) => {
    const reqIds = req.body.slotIds;

    const validation = validateArrayData(remove_slot_time_schema, reqIds);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    await SlotTime.updateMany(
        { _id: { $in: reqIds } },
        { $set: { soft_delete: true } }
    );

    const response = response200("Slot removed successfully", {});
    return res.status(response[0]).json(response[1]);
}));

//Checking available slots for academy and memberships
router.get('/get-available-slots', asyncHandler(async (req: Request, res: Response) => {
    const reqQuery = req.query;

    const validation = validateObjectData(get_available_slots_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    let groundId = new Types.ObjectId(String(reqQuery.ground));
    let cityId = new Types.ObjectId(String(reqQuery.city));

    const academySlots = (await Academy.find({ ground: groundId, city: cityId ,soft_delete: false, is_active: true })).map((academy) => academy.slots);
    const allAcademySlots = academySlots.length > 0 ? academySlots.flatMap(entry => [...entry.morning, ...entry.evening]) : [];
    const membershipSlots = (await Membership.find({ ground: groundId, city: cityId, soft_delete: false, is_active: true })).map((membership) => membership.slots);
    const allMembershipSlots = membershipSlots.length > 0 ? membershipSlots.flatMap(entry => [...entry.morning, ...entry.evening]) : [];

    let mergedArray = allAcademySlots.concat(allMembershipSlots);
    let uniqueIds = [...new Set(mergedArray.flat())];

    let availableSlots = (await SlotTime.find({
        soft_delete: false,
        is_active: true,
        ground: groundId,
        city: cityId
    })).map((slot) => {
        return {
            id: slot._id,
            slot: slot.slot,
            booked: false,
            price: slot.price
        }
    });
    
    availableSlots.forEach((slot) => {
        if (uniqueIds.some(id => id.equals(slot.id))) {
            slot.booked = true;
        } else {
            slot.booked = false;
        }
    });

    const response = response200("Available slots fetched successfully", availableSlots);
    return res.status(response[0]).json(response[1]);
}));

//Checking available slots for events
router.get('/available-slots-for-event', asyncHandler(async (req: Request, res: Response) => {
    const reqQuery = req.query;

    const validation = validateObjectData(available_slots_for_event, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const start_date = new Date(String(reqQuery.start_date));
    const end_date = new Date(String(reqQuery.end_date));

    if (start_date > end_date) throw new CustomError("Invalid dates", 406);

    start_date.setHours(0);
    start_date.setMinutes(0);
    start_date.setSeconds(0);
    start_date.setMilliseconds(0);

    end_date.setHours(23);
    end_date.setMinutes(59);
    end_date.setSeconds(59);
    end_date.setMilliseconds(999);

    const where = {
        grounds: String(reqQuery.ground),
        start_date: { $lte: start_date },
        end_date: { $gte: end_date },
        is_active: true,
        soft_delete: false
    }

    let eventBookedSlots = (await Event.find(where)).map((event) => event.slots);

    let availableSlots = (await SlotTime.find({
        soft_delete: false,
        is_active: true,
        ground: new Types.ObjectId(String(reqQuery.ground))
    })).map((slot) => {
        return {
            id: slot._id,
            slot: slot.slot,
            booked: false
        }
    });

    const bookedSlotIds = eventBookedSlots.flat();

    availableSlots.forEach(slot => {
        if (bookedSlotIds.some(bookedId => bookedId.equals(slot.id))) {
            slot.booked = true;
        }
    });

    const response = response200("Available slots for event fetched successfully", availableSlots);
    res.status(response[0]).json(response[1]);
}));

export default router;