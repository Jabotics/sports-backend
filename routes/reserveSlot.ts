import { CustomRequest } from "../server";
import { FilterQuery, Types } from "mongoose";
import { IReservation } from "../types/types";
import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { response200 } from "../lib/helpers/utils";
import { Request, Response, Router } from "express";
import verifyJWT from "../middlewares/authentication";
import { add, menus, update, view } from "../middlewares/permission";
import { validateArrayData, validateObjectData } from "../lib/helpers/validation";
import { City, Customer, Ground, Reservation, ReservationSlot, SlotBooking, Venue } from "../schemas/schema";
import { add_new_reservation_slot, cancel_booking_schema, cancel_reservation_schema, cancel_reservation_slot, get_reservation_details, get_reserved_slots_schema, remove_reservation_schema, reserve_slot_schema, update_reservation_schema, update_reservation_slot } from "../validation/reserveSlotValidation";

const router = Router();

interface ReservedSlotsQuery extends FilterQuery<IReservation> {
    _id?: Types.ObjectId;
    venue?: {
        $in: Types.ObjectId[];
    }
    ground?: {
        $in: Types.ObjectId[];
    }
    city?: string;
}

interface slotDates {
    date: Date;
    slots: string[];
}

router.post('/reserve-slot', [verifyJWT, add(menus.Reservation)], asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqData = req.body;
    const user = req.user;

    if (!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(reserve_slot_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const city = await City.findOne({ _id: reqData.city, is_active: true, soft_delete: false });
    if (!city) throw new CustomError("City does not exist or is disabled", 406);

    const venue = await Venue.findOne({ _id: reqData.venue, is_active: true, soft_delete: false });
    if (!venue) throw new CustomError("Venue does not exist or is disabled", 406);

    const ground = await Ground.findOne({ _id: reqData.ground, is_active: true, soft_delete: false });
    if (!ground) throw new CustomError("Ground does not exist or is disabled", 406);

    if ('venue' in user && Array.isArray(user.venue) && user.venue.length != 0 && !user.venue.includes(reqData.venue)) throw new CustomError("Permission denied", 403);
    if ('ground' in user && Array.isArray(user.ground) && user.ground.length != 0 && !user.ground.includes(reqData.ground)) throw new CustomError("Permission denied", 403);


    //Checking bookings
    reqData.slot_dates.map(async (slot: any) => {
        const start_date = new Date(slot.date);        
        start_date.setHours(0);
        start_date.setMinutes(0);
        start_date.setSeconds(0);
        start_date.setMilliseconds(0);
        const where = {
            ground: reqData.ground,
            date: start_date,
            slots: {$in: slot.slots}
        }        
        const booking = await SlotBooking.findOne(where);        
        if (booking) throw new CustomError("Slot already booked", 406);
    });

    //Checking reservation
    reqData.slot_dates.map(async (slot: any) => {
        const start_date = new Date(slot.date);        
        start_date.setHours(0);
        start_date.setMinutes(0);
        start_date.setSeconds(0);
        start_date.setMilliseconds(0);
        const where = {
            ground: reqData.ground,
            date: start_date,
            slots: {$in: slot.slots},
            booking_status: "Booked"
        }        
        const reservation = await ReservationSlot.findOne(where);        
        if(reservation) throw new CustomError("Slot already booked", 406);
    });

    let customer = await Customer.findOne({ mobile: reqData.mobile, soft_delete: false });
    if (!customer) {
        customer = await Customer.create({
            first_name: reqData.first_name,
            last_name: reqData.last_name,
            mobile: reqData.mobile
        });
    }
    else {
        await Customer.findByIdAndUpdate(customer._id, {
            first_name: reqData.first_name,
            last_name: reqData.last_name
        });
    }

    const reservation = await Reservation.create({
        city: reqData.city,
        venue: reqData.venue,
        ground: reqData.ground,
        customer: customer._id,
        total_amount: reqData.total_amount,
        discount: reqData.discount,
        payment_mode: reqData.payment_mode,
        payment_details: reqData.payment_details
    });

    reqData.slot_dates.map(async (slot: slotDates) => {
        const date = new Date(slot.date);

        date.setHours(0);
        date.setMinutes(0);
        date.setSeconds(0);
        date.setMilliseconds(0);
        await ReservationSlot.create({
            date,
            slots: slot.slots,
            reservation: reservation._id,
            booking_status: reqData.booking_status,
            ground: reqData.ground
        });
    });
    
    const response = response200("Slots reserved successfully", { id: reservation._id, customer_id: customer._id });
    return res.status(response[0]).json(response[1]);
}));

router.get('/get-reserved-slots', [verifyJWT, view(menus.Reservation)], asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqQuery = req.query;
    const user = req.user;

    if (!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(get_reserved_slots_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: ReservedSlotsQuery = {
        soft_delete: false
    }

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

    if ('city' in user && user.city) {
        where.city = String(user.city._id);
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

    const reservations = (await Reservation.find(where)
        .populate({ path: 'ground', select: 'name', options: { strictPopulate: false } })
        .populate({ path: 'venue', select: 'name', options: { strictPopulate: false } })
        .populate({ path: 'customer', select: ['first_name', 'last_name', 'mobile'], options: { strictPopulate: false } })
        .populate({ path: 'city', select: 'name', options: { strictPopulate: false } })
        .limit(Number(reqQuery.limit || 10000))
        .skip(Number(reqQuery.offset || 0))
    )
        .map((res) => {
            let all_payments = 0;
            let payment_details = res.payment_details.map((detail) => {
                all_payments += detail.amount;
                return {
                    payment_date: detail.payment_date.toDateString(),
                    amount: detail.amount,
                    payment_mode: detail.payment_mode
                }
            });
            let remaining_amount = res.total_amount - all_payments;
            return {
                id: res._id,
                venue: res.venue,
                customer: res.customer,
                ground: res.ground,
                total_amount: res.total_amount,
                discount: res.discount,
                payment_details,
                remaining_amount
            }
        });

    const count = await Reservation.countDocuments({});

    const response = response200("Reservation fetched successfully", { count, reservations });
    return res.status(response[0]).json(response[1]);
}));

router.get('/get-reservation-details', [verifyJWT, view(menus.Reservation)], asyncHandler(async (req: Request, res: Response) => {
    const reqQuery = req.query;

    const validation = validateObjectData(get_reservation_details, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const reservation_slots = (await ReservationSlot.find({ reservation: String(reqQuery.id) })
        .populate({ path: 'slots', select: 'slot', options: { strictPopulate: false } }))
        .map((slot) => {
            return {
                id: slot._id,
                slots: slot.slots,
                date: slot.date.toDateString(),
                reservation_id: slot.reservation,
                booking_status: slot.booking_status,
            }
        });

    const response = response200("Slots fetched successfully", { reservation_slots });
    return res.status(response[0]).json(response[1]);
}));

// Cancel a slot for a date
router.post('/cancel-reservation-slot', [verifyJWT, update(menus.Reservation)], asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqData = req.body;
    const user = req.user;

    if (!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(cancel_reservation_slot, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const reservation = await Reservation.findById(reqData.reservation_id);
    if (!reservation) throw new CustomError("Reservation not found", 404);

    if ('venue' in user && Array.isArray(user.venue) && user.venue.length != 0 && !user.venue.includes(reservation.venue)) throw new CustomError("Permission denied", 403);
    if ('ground' in user && Array.isArray(user.ground) && user.ground.length != 0 && !user.ground.includes(reservation.ground)) throw new CustomError("Permission denied", 403);

    const reserved_slot = await ReservationSlot.findOne({ reservation: reqData.reservation_id, slots: { $in: [reqData.slot_id] } });
    if (!reserved_slot) throw new CustomError("No reservation slot found", 406);
    if (reserved_slot.booking_status == 'Completed' || reserved_slot.booking_status == 'Cancelled') throw new CustomError("Reservation already completed or cancelled", 406);

    await ReservationSlot.findByIdAndUpdate(reqData.booking_id, { $pull: { slots: reqData.slot_id } });

    const response = response200("Reservation cancelled successfully", { id: reqData.slot_id });
    return res.status(response[0]).json(response[1]);
}));

// update reservation
router.post('/update-reservation', [verifyJWT, update(menus.Reservation)], asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;    

    const validation = validateObjectData(update_reservation_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const data = {
        total_amount: reqData.total_amount,
        payment_details: reqData.payment_details,
        discount: reqData?.discount
    }

    await Reservation.findByIdAndUpdate(reqData.id, { $set: data });

    const response = response200("Data updated", { id: reqData.id });
    return res.status(response[0]).json(response[1]);
}));

// update the reservation slot / cancel a single slot from reservation
router.post('/update-reservation-slot', [verifyJWT, update(menus.Reservation)], asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    const validation = validateObjectData(update_reservation_slot, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const reserved_slot = await ReservationSlot.findOne({ reservation: reqData.reservation_id, _id: reqData.slot_id });
    if (!reserved_slot) throw new CustomError("No reservation slot found", 406);
    if (reserved_slot.booking_status == 'Completed' || reserved_slot.booking_status == 'Cancelled') throw new CustomError("Reservation already completed or cancelled", 406);

    const ground = await Ground.findOne({ _id: reserved_slot.ground, is_active: true, soft_delete: false });
    if (!ground) throw new CustomError("Ground does not exists or is disabled", 406);

    const data = {
        date: reserved_slot.date,
        slots: reqData?.slots
    }

    if (reqData.date) {
        const start_date = new Date(reqData.date);

        start_date.setHours(0);
        start_date.setMinutes(0);
        start_date.setSeconds(0);
        start_date.setMilliseconds(0);

        data.date = start_date
    }

    await ReservationSlot.findByIdAndUpdate(reqData.slot_id, { $set: data });

    const response = response200("Slot updated", { id: reqData.slot_id });
    return res.status(response[0]).json(response[1]);
}));

// For add new slot in existing reservation
router.post('/add-new-reservation-slot', [verifyJWT, update(menus.Reservation)], asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    const validation = validateObjectData(add_new_reservation_slot, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const reservation = await Reservation.findOne({ _id: reqData.reservation_id, soft_delete: false });
    if (!reservation) throw new CustomError("Reservation not found", 404);
    
    let bookingIds: any = [];
    const promises = reqData.slot_dates.map(async (slot: slotDates)=>{        
        const date = new Date(slot.date);

        date.setHours(0);
        date.setMinutes(0);
        date.setSeconds(0);
        date.setMilliseconds(0);

    
        const newSlot = await ReservationSlot.create({
            reservation: reqData.reservation_id,
            ground: reservation.ground,
            date,
            booking_status: 'Booked',
            slots: slot.slots
        });
        
        bookingIds.push(String(newSlot._id))
    })

    await Promise.all(promises);

    const response = response200("Slot added", { bookingIds });
    return res.status(response[0]).json(response[1]);
}));

//Cancel a reserved booking (for 1 day)
router.post('/cancel-reservation-booking', [verifyJWT, update(menus.Reservation)], asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    const validation = validateObjectData(cancel_booking_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const reservation = await Reservation.findById(reqData.reservation_id);
    if (!reservation) throw new CustomError("Reservation not found", 404);

    await ReservationSlot.findByIdAndUpdate(reqData.booking_id, { $set: { booking_status: 'Cancelled' } });

    const response = response200("Booking cancelled", { id: reqData.booking_id });
    return res.status(response[0]).json(response[1]);
}));

//Cancel reservation and all its slot bookings
router.post('/cancel-reservation', [verifyJWT, update(menus.Reservation)], asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    const validation = validateObjectData(cancel_reservation_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const reservation = await Reservation.findOne({ _id: reqData.reservation_id, soft_delete: false });
    if (!reservation) throw new CustomError("Reservation not found", 404);

    await ReservationSlot.updateMany(
        { reservation: reqData.reservation_id },
        { $set: { booking_status: 'Cancelled' } }
    );

    const response = response200("Reservation cancelled", { id: reqData.reservation_id });
    return res.status(response[0]).json(response[1]);
}));

//Remove reservation
router.post('/remove-reservation', asyncHandler(async (req: Request, res: Response) => {
    const reqIds = req.body.reservationIds;

    const validation = validateArrayData(remove_reservation_schema, reqIds);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    await ReservationSlot.deleteMany({ reservation: { $in: reqIds } });

    await Reservation.updateMany(
        { _id: { $in: reqIds } },
        { $set: { soft_delete: true } }
    );

    const response = response200(`${reqIds.length > 1 ? 'Reservations' : 'Reservation'} removed successfully`, {});
    return res.status(response[0]).json(response[1]);
}));

export default router;