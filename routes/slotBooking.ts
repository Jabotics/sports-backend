import { Types } from 'mongoose';
import { FilterQuery } from 'mongoose';
import { CustomRequest } from '../server';
import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { Request, Response, Router } from "express";
import verifyJWT from '../middlewares/authentication';
import { add, menus, update, view } from '../middlewares/permission';
import { validateObjectData } from "../lib/helpers/validation";
import { ISlotBooking, SlotBookingStatus } from '../types/types';
import { checkGroundSlotTime, response200 } from "../lib/helpers/utils";
import { Academy, Customer, Event, Ground, Membership, ReservationSlot, SlotBooking, SlotTime, Venue } from "../schemas/schema";
import { add_slot_booking_schema, book_slot_schema, get_available_slots_schema, get_booking_schema, update_booking_schema } from "../validation/slotBookingValidation";

interface BookingQuery extends FilterQuery<ISlotBooking> {
    _id?: Types.ObjectId;
    venue?: {
        $in: Types.ObjectId[];
    };
    ground?: {
        $in: Types.ObjectId[];
    };
    city?: Types.ObjectId;
}

interface UpdateData {
    ground: string;
    venue: string;
    slots?: string[];
    date?: Date;
    booking_status: SlotBookingStatus;
}

interface customerSearchQuery {
    path: string,
    select: string[],
    options: {
        strictPopulate: boolean
    },
    match?: {
        $or: [
            {
                mobile: {$regex: string, $options: string}
            }
        ]
    }
}

const router = Router();

router.post('/add-slot-booking', [verifyJWT, add(menus.Slot_Bookings)], asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    const validation = validateObjectData(add_slot_booking_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const ground = await Ground.countDocuments({ _id: reqData.ground, is_active: true, soft_delete: false });
    if (ground == 0) throw new CustomError("Ground does not exist or is disabled", 406);

    const venue = await Venue.countDocuments({ _id: reqData.venue, is_active: true, soft_delete: false });
    if (venue == 0) throw new CustomError("Venue does not exist or is disabled", 406);

    const customer = await Customer.countDocuments({ _id: reqData.customer, is_active: true, soft_delete: false });
    if (customer == 0) throw new CustomError("Customer does not exist or is disabled", 406);

    const slots = await SlotTime.find({ _id: { $in: reqData.slots }, is_active: true, soft_delete: false });
    if (slots.length == 0) throw new CustomError("Slot does not exist or is disabled", 406);
    if (!checkGroundSlotTime(reqData.ground, slots)) throw new CustomError("Ground does not support the slot you selected", 406);

    const start_date = new Date(reqData.date);
    const end_date = new Date(reqData.date);

    const day = start_date.getDay();
    let amount = 0;
    switch (day) {
        case 0:
            slots.map((slot) => {
                amount += slot.price["sun"];
            });
            break;
        case 1:
            slots.map((slot) => {
                amount += slot.price["mon"];
            });
            break;
        case 2:
            slots.map((slot) => {
                amount += slot.price["tue"];
            });
            break;
        case 3:
            slots.map((slot) => {
                amount += slot.price["wed"];
            });
            break;
        case 4:
            slots.map((slot) => {
                amount += slot.price["thu"];
            });
            break;
        case 5:
            slots.map((slot) => {
                amount += slot.price["fri"];
            });
            break;
        default:
            slots.map((slot) => {
                amount += slot.price["sat"];
            });
    }

    start_date.setHours(0);
    start_date.setMinutes(0);
    start_date.setSeconds(0);
    start_date.setMilliseconds(0);

    end_date.setHours(23);
    end_date.setMinutes(59);
    end_date.setSeconds(59);
    end_date.setMilliseconds(999);

    const booking = await SlotBooking.findOne({
        ground: reqData.ground,
        date: start_date,
        slots: reqData.slots
    });
    if (booking) throw new CustomError("Slot already booked", 406);

    const where = {
        grounds: reqData.ground,
        start_date: { $lte: start_date },
        end_date: { $gte: end_date }
    }

    const checkEvents = await Event.find(where);
    if (checkEvents.length != 0) throw new CustomError("Ground is already reserved", 406);

    const checkAcademy = await Academy.find({
        slotTimes: { $in: reqData.slots },
        soft_delete: false,
        is_active: true
    });
    if (checkAcademy.length != 0) throw new CustomError("Slots are reserved for academy", 406);

    const checkMembership = await Membership.find({
        slotTimes: { $in: reqData.slots },
        soft_delete: false,
        is_active: true
    });
    if (checkMembership.length != 0) throw new CustomError("Slots are reserved for membership", 406);

    const data = {
        date: start_date,
        city: reqData.city,
        slots: reqData.slots,
        venue: reqData.venue,
        ground: reqData.ground,
        booking_amount: amount,
        customer: reqData.customer,
        promo_code: reqData?.promo_code,
    }

    const newBooking = await SlotBooking.create(data);

    const response = response200("Booking confirmed", { id: newBooking._id });
    return res.status(response[0]).json(response[1]);
}));

router.get('/get-available-booking-slots', asyncHandler(async (req: Request, res: Response) => {
    const reqQuery = req.query;

    //format date
    const start_date = new Date(String(reqQuery.date));
    const end_date = new Date(String(reqQuery.date));

    start_date.setHours(0);
    start_date.setMinutes(0);
    start_date.setSeconds(0);
    start_date.setMilliseconds(0);

    end_date.setHours(23);
    end_date.setMinutes(59);
    end_date.setSeconds(59);
    end_date.setMilliseconds(999);

    const validation = validateObjectData(get_available_slots_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const allSlots = (await SlotTime.find({
        ground: String(reqQuery.ground),
        soft_delete: false,
        is_active: true,
    })).map((slot) => {
        return {
            id: slot._id,
            slot: slot.slot,
            price: slot.price,
        }
    });

    //Fetch Booked Slots
    const bookings = (await SlotBooking.find({
        ground: String(reqQuery.ground),
        date: start_date,
    })).map(booking => booking.slots);

    let bookedSlots = bookings.reduce((acc, curr) => acc.concat(curr), []);

    // Fetch Academy Slots
    const academy = (await Academy.find({
        ground: String(reqQuery.ground),
        soft_delete: false,
        is_active: true,
    })).map((slot) => {
        return {
            slots: slot.slots,
            active_days: slot.active_days
        }
    });
    
    //Checking academy slots day wise
    let academySlots: any = [];
    switch (start_date.getDay()) {
        case 0:
            academy.forEach(ele => {
                if (ele.active_days.includes('sun')) {
                    ele.slots.morning.forEach(slot => academySlots.push(slot));
                    ele.slots.evening.forEach(slot => academySlots.push(slot));  
                }
            });
            break;
        case 1:
            academy.forEach(ele => {
                if (ele.active_days.includes('mon')) {
                    ele.slots.morning.forEach(slot => academySlots.push(slot));
                    ele.slots.evening.forEach(slot => academySlots.push(slot));  
                }
            });
            break;
        case 2:
            academy.forEach(ele => {
                if (ele.active_days.includes('tue')) {
                    ele.slots.morning.forEach(slot => academySlots.push(slot));
                    ele.slots.evening.forEach(slot => academySlots.push(slot));  
                }
            });
            break;
        case 3:
            academy.forEach(ele => {
                if (ele.active_days.includes('wed')) {
                    ele.slots.morning.forEach(slot => academySlots.push(slot));
                    ele.slots.evening.forEach(slot => academySlots.push(slot));  
                }
            });
            break;
        case 4:
            academy.forEach(ele => {
                if (ele.active_days.includes('thu')) {
                    ele.slots.morning.forEach(slot => academySlots.push(slot));
                    ele.slots.evening.forEach(slot => academySlots.push(slot));  
                }
            });
            break;
        case 5:
            academy.forEach(ele => {
                if (ele.active_days.includes('fri')) {
                    ele.slots.morning.forEach(slot => academySlots.push(slot));
                    ele.slots.evening.forEach(slot => academySlots.push(slot));  
                }
            });
            break;
        default:
            academy.forEach(ele => {
                if (ele.active_days.includes('sat')) {                    
                    ele.slots.morning.forEach(slot => academySlots.push(slot));
                    ele.slots.evening.forEach(slot => academySlots.push(slot));                    
                }
            });
            break;
    }    

    //Fetch Membership Slots
    const membershipSlots = (await Membership.find({
        ground: String(reqQuery.ground),
        soft_delete: false,
        is_active: true
    })).map((slot) => {
        return slot.slots
    }).flatMap(entry=> [...entry.morning, ...entry.evening]);

    //Fetch Event Slots
    const where = { 
        grounds: String(reqQuery.ground),
        start_date: { $lte: start_date },
        end_date: { $gte: end_date },
        is_active: true,
        soft_delete: false
    }

    let event = await Event.find(where);

    //Fetch Reserved Slots    
    const where_clause = {
        ground: String(reqQuery.ground),
        date: { $eq: start_date },
        booking_status: 'Booked'
    }

    const reservation = (await ReservationSlot.find(where_clause)).map(res => res.slots);

    let bookedSlotArray = [];
    let allBookedSlots = bookedSlots.concat(...academySlots, ...membershipSlots, ...reservation.flat());

    let bookedSlotString = allBookedSlots.map(obj => obj.toString());
    let eventSlotsString = event.length != 0 ? event[0].slots.map(obj => obj.toString()) : [];
    let bookedSlotSet = [...new Set([...bookedSlotString, ...eventSlotsString])];
    let x = Array.from(bookedSlotSet, str => new Types.ObjectId(str));
    bookedSlotArray.push(...x);

    const slotsAvailability = allSlots.map(slot => ({
        id: slot.id,
        slot: slot.slot,
        price: slot.price,
        available: bookedSlotArray.length != 0 ? !bookedSlotArray.some(booked => booked.equals(slot.id)) : !allBookedSlots.some(booked => booked.equals(slot.id)),
        date: start_date
    }));

    const response = response200("Available slot list", { available_slots: slotsAvailability });
    return res.status(response[0]).json(response[1]);
}));

router.get('/get-slot-bookings', [verifyJWT, view(menus.Slot_Bookings)] ,asyncHandler(async (req: CustomRequest, res: Response) => {
    let reqQuery = req.query;
    reqQuery = {
        ...reqQuery,
        ground: reqQuery.ground && JSON.parse(String(reqQuery.ground))
    }
    const user = req.user;

    if(!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(get_booking_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: BookingQuery = {
        soft_delete: false
    }

    if('city' in user && user.city) {
        where.city = user.city._id
    }

    reqQuery.id && (where.id = new Types.ObjectId(String(reqQuery.id)));
    reqQuery.customer && (where.customer = new Types.ObjectId(String(reqQuery.customer)));
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

    //Search using customer mobile number
    let customerQuery: customerSearchQuery = {
        path: 'customer',
        select: ['name', 'mobile'],
        options: {
            strictPopulate: false
        }
    };
    if(reqQuery.search) {
        customerQuery.match = {
            $or: [
                {
                    mobile: {
                        $regex: String(reqQuery.search),
                        $options: 'i'
                    }
                }
            ]
        }
    }    

    const bookings = (await SlotBooking.find(where)
        .populate({ path: 'city', select: 'name', options: { strictPopulate: false } })
        .populate({ path: 'slots', select: 'slot', options: { strictPopulate: false } })
        .populate({ path: 'venue', select: ['name', 'address', 'geo_location'], options: { strictPopulate: false } })
        .populate(customerQuery)
        .populate({ path: 'ground', select: 'name', options: { strictPopulate: false }, populate: { path: 'supported_sports', select: 'name', options: { strictPopulate: false } } })
        .skip(Number(reqQuery.offset) || 0)
        .limit(Number(reqQuery.limit) || 10000)
    )
    .filter(booking => booking.customer)
    .map((booking) => {

        return {
            id: booking._id,
            customer: booking.customer,
            city: booking.city,
            venue: booking.venue,
            ground: booking.ground,
            booking_status: booking.booking_status,
            date: new Date(booking.date).toDateString(),
            slots: booking.slots,
            booking_amount: booking.booking_amount
        }
    });

    const count = await SlotBooking.countDocuments(where);

    const response = response200("Bookings fetched successfully", { count, bookings });
    return res.status(response[0]).json(response[1]);
}));

router.post('/update-slot-booking', [verifyJWT, update(menus.Slot_Bookings)], asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    const validation = validateObjectData(update_booking_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const booking = await SlotBooking.findOne({ _id: reqData.id, customer: reqData.customer, soft_delete: false });
    if (!booking) throw new CustomError("No booking found", 406);
    if (booking.booking_status == 'Completed' || booking.booking_status == 'Cancelled') throw new CustomError("Booking already completed or cancelled", 406);

    const ground = await Ground.countDocuments({ _id: reqData.ground, is_active: true, soft_delete: false });
    if (ground == 0) throw new CustomError("Ground does not exist or is disabled", 406);

    const venue = await Venue.countDocuments({ _id: reqData.venue, is_active: true, soft_delete: false });
    if (venue == 0) throw new CustomError("Venue does not exist or is disabled", 406);

    const customer = await Customer.countDocuments({ _id: reqData.customer, is_active: true, soft_delete: false });
    if (customer == 0) throw new CustomError("Customer does not exist or is disabled", 406);

    if (reqData.slots) {
        const slots = await SlotTime.find({ _id: { $in: reqData.slots }, is_active: true, soft_delete: false });
        if (slots.length == 0) throw new CustomError("Slot does not exist or is disabled", 406);
        if (!checkGroundSlotTime(reqData.ground, slots)) throw new CustomError("Ground does not support the slot you selected", 406);
    }

    const data: UpdateData = {
        ground: reqData.ground,
        venue: reqData.venue,
        slots: reqData?.slots,
        date: reqData.date,
        booking_status: reqData.booking_status,
    }

    if (reqData.date) {
        const start_date = new Date(reqData.date);
        const end_date = new Date(reqData.date);

        start_date.setHours(0);
        start_date.setMinutes(0);
        start_date.setSeconds(0);
        start_date.setMilliseconds(0);

        end_date.setHours(23);
        end_date.setMinutes(59);
        end_date.setSeconds(59);
        end_date.setMilliseconds(999);

        const booking = await SlotBooking.findOne({
            ground: reqData.ground,
            date: start_date,
            slots: reqData.slots
        });
        if (booking) throw new CustomError("Slot already booked", 406);

        const where = {
            grounds: reqData.ground,
            start_date: { $lte: start_date },
            end_date: { $gte: end_date }
        }

        const checkEvents = await Event.find(where);
        if (checkEvents.length != 0) throw new CustomError("Ground is already reserved", 406);

        const checkAcademy = await Academy.find({
            slotTimes: { $in: reqData.slots },
            soft_delete: false,
            is_active: true
        });
        if (checkAcademy.length != 0) throw new CustomError("Slots are reserved for academy", 406);

        const checkMembership = await Membership.find({
            slotTimes: { $in: reqData.slots },
            soft_delete: false,
            is_active: true
        });
        if (checkMembership.length != 0) throw new CustomError("Slots are reserved for membership", 406);

        data.date = start_date;
    }
    else {
        delete data.date;
    }

    await SlotBooking.updateOne({ _id: reqData.id }, data);

    const msg = reqData.booking_status == 'Cancelled' ? "Booking cancelled" : "Booking updated";

    const response = response200(msg, { id: reqData.id });
    return res.status(response[0]).json(response[1]);
}));

//For user side
router.post('/book-slot', verifyJWT, asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    const validation = validateObjectData(book_slot_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const ground = await Ground.countDocuments({ _id: reqData.ground, is_active: true, soft_delete: false });
    if (ground == 0) throw new CustomError("Ground does not exist or is disabled", 406);

    const venue = await Venue.countDocuments({ _id: reqData.venue, is_active: true, soft_delete: false });
    if (venue == 0) throw new CustomError("Venue does not exist or is disabled", 406);

    const customer = await Customer.countDocuments({ _id: reqData.customer, is_active: true, soft_delete: false });
    if (customer == 0) throw new CustomError("Customer does not exist or is disabled", 406);

    const slots = await SlotTime.find({ _id: { $in: reqData.slots }, is_active: true, soft_delete: false });
    if (slots.length == 0) throw new CustomError("Slot does not exist or is disabled", 406);
    if (!checkGroundSlotTime(reqData.ground, slots)) throw new CustomError("Ground does not support the slot you selected", 406);

    const start_date = new Date(reqData.date);
    const end_date = new Date(reqData.date);

    start_date.setHours(0);
    start_date.setMinutes(0);
    start_date.setSeconds(0);
    start_date.setMilliseconds(0);

    end_date.setHours(23);
    end_date.setMinutes(59);
    end_date.setSeconds(59);
    end_date.setMilliseconds(999);

    const booking = await SlotBooking.findOne({
        ground: reqData.ground,
        date: start_date,
        slots: reqData.slots
    });
    if (booking) throw new CustomError("Slot already booked", 406);

    const where = {
        grounds: reqData.ground,
        start_date: { $lte: start_date },
        end_date: { $gte: end_date }
    }

    const checkEvents = await Event.find(where);
    if (checkEvents.length != 0) throw new CustomError("Ground is already reserved", 406);

    let dayIndex = start_date.getDay();
    let day = 'sun';
    switch (dayIndex) {
        case 0:
            day = 'sun';
            break;
        case 1:
            day = 'mon';
            break;
        case 2:
            day = 'tue';
            break;
        case 3:
            day = 'wed';
            break;
        case 4:
            day = 'thu';
            break;
        case 5:
            day = 'fri';
            break;
        default:
            day = 'sat'
    }

    const checkAcademy = await Academy.find({
        slotTimes: { $in: reqData.slots },
        soft_delete: false,
        is_active: true,
        active_days: { $in: [day] }
    });
    if (checkAcademy.length != 0) throw new CustomError("Slots are reserved for academy", 406);

    const checkMembership = await Membership.find({
        slotTimes: { $in: reqData.slots },
        soft_delete: false,
        is_active: true
    });
    if (checkMembership.length != 0) throw new CustomError("Slots are reserved for membership", 406);

    const data = {
        date: start_date,
        city: reqData.city,
        slots: reqData.slots,
        venue: reqData.venue,
        ground: reqData.ground,
        customer: reqData.customer,
        booking_amount: reqData.amount,
        promo_code: reqData?.promo_code,
    }

    const newBooking = await SlotBooking.create(data);

    const response = response200("Booking confirmed", { id: newBooking._id });
    return res.status(response[0]).json(response[1]);
}));

router.get('/my-bookings', verifyJWT, asyncHandler(async (req: CustomRequest, res: Response) => {
    const user = req.user;

    if (!user) throw new CustomError("Session expired, please login again", 403);

    const bookings = (await SlotBooking.find({ customer: user.id, soft_delete: false })        
        .populate({ path: 'slots', select: 'slot', options: { strictPopulate: false } })
        .populate({ path: 'venue', select: ['name', 'address'], options: { strictPopulate: false } })        
        .populate({ path: 'ground', select: 'name', options: { strictPopulate: false }, populate: { path: 'supported_sports', select: 'name', options: { strictPopulate: false } } })
    ).map((booking) => {
        return {
            id: booking._id,                        
            venue: booking.venue,
            ground: booking.ground,
            booking_status: booking.booking_status,
            date: new Date(booking.date).toDateString(),
            slots: booking.slots,
            booking_amount: booking.booking_amount
        }
    })

    const count = await SlotBooking.countDocuments({ customer: user.id, soft_delete: false });

    const response = response200("", { count, bookings });
    return res.status(response[0]).json(response[1]);
}));

export default router;