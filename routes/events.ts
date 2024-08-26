import sharp from "sharp";
import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { Request, Response, Router } from "express";
import { EventStatus, IEvent } from "../types/types";
import verifyJWT from "../middlewares/authentication";
import { FilterQuery, SortOrder, Types } from "mongoose";
import { Event, Ground, SlotTime } from "../schemas/schema";
import { image_validation_schema } from "../validation/imageValidation";
import { add, menus, remove, update, view } from "../middlewares/permission";
import { validateArrayData, validateObjectData } from "../lib/helpers/validation";
import { checkGroundSlotTime, findFile, removeFile, response200, saveImage, uploadPaths } from "../lib/helpers/utils";
import { add_event_schema, get_event_schema, remove_events_schema, update_event_schema } from "../validation/eventValidation";

interface EventQuery extends FilterQuery<IEvent> {
    $or?: Array<{ [key: string]: any }>;
    is_active?: {
        $in: Array<boolean>;
    };
    is_public?: {
        $in: Array<boolean>;
    }
    registration_status?: {
        $in: string[]
    };
    event_status?: {
        $in: string[]
    };
    _id?: Types.ObjectId;
}

const router = Router();

router.post('/add-event', [verifyJWT, add(menus.EVENTS)], asyncHandler(async (req: Request, res: Response) => {
    let reqData = req.body;
    reqData = { ...reqData, grounds: JSON.parse(reqData.grounds), slots: reqData.slots && JSON.parse(reqData.slots) }
    const reqImage = req.files;

    const validation = validateObjectData(add_event_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if (Array.isArray(reqImage) && reqImage?.length != 0) {
        const imgValidation = validateObjectData(image_validation_schema, reqImage[0]);
        if (imgValidation.error) throw new CustomError(imgValidation.error.message, 406, imgValidation.error.details[0].context?.key);
    }

    const ground = await Ground.find({ _id: { $in: reqData.grounds }, is_active: true, soft_delete: false });
    if (ground.length == 0) throw new CustomError("Ground not found", 406);

    if (reqData.slots && Array.isArray(reqData.slots) && reqData.slots.length != 0) {
        const slots = await SlotTime.find({ _id: { $in: reqData.slots }, is_active: true, soft_delete: false });
        if (slots.length == 0) throw new CustomError("Slot does not exist or is disabled", 406);
        Array.isArray(reqData.grounds) && reqData.grounds.forEach((ground: any) => {
            if (!checkGroundSlotTime(ground, slots)) throw new CustomError("Ground does not have the slots you selected", 406);
        });
    }

    let start_date = new Date(reqData.start_date)
    let end_date = new Date(reqData.end_date)

    if (end_date < start_date) throw new CustomError("Invalid dates", 406);

    start_date.setHours(0);
    start_date.setMinutes(0);
    start_date.setSeconds(0);
    start_date.setMilliseconds(0);

    end_date.setHours(23);
    end_date.setMinutes(59);
    end_date.setSeconds(59);
    end_date.setMilliseconds(999);    

    // const slots = (await SlotTime.find({
    //     ground: { $in: reqData.grounds },
    //     soft_delete: false,
    //     is_active: true
    // })).map(slot => slot._id);

    const data = {
        name: reqData.name,
        duration: reqData.duration,
        start_date: start_date,
        end_date: end_date,
        grounds: reqData.grounds,
        sports: reqData?.sports,
        registration_status: reqData.registration_status,
        event_status: EventStatus.UPCOMING,
        slots: reqData.slots,
        description: reqData.description
    }

    const events = await Event.find({ grounds: { $in: reqData.grounds }, start_date: start_date.toISOString(), end_date: end_date.toISOString(), soft_delete: false, is_active: true });
    if (events.length != 0) throw new CustomError("An event is already registered for this ground", 406);

    const event = await Event.create(data);

    let img_url = null;
    if (Array.isArray(reqImage) && reqImage.length != 0) {
        const compressedBuffer = await new Promise<Buffer>((resolve, reject) => {
            sharp(reqImage[0].buffer as Buffer)
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
        await saveImage(uploadPaths.events, `${event._id}-event-${reqImage[0].originalname}`, compressedBuffer);
        let url = await findFile(event._id, uploadPaths.events);
        img_url = url[0];
        img_url !== null && await Event.findByIdAndUpdate(
            { _id: event._id },
            { $set: { image: img_url } }
        );
    }

    const response = response200("Event created successfully", { id: event._id });
    return res.status(response[0]).json(response[1]);
}));

router.get('/get-events', [verifyJWT, view(menus.EVENTS)], asyncHandler(async (req: Request, res: Response) => {
    let reqQuery = req.query;
    reqQuery = {
        ...reqQuery,
        is_active: reqQuery.is_active && JSON.parse(String(reqQuery.is_active)),
        registration_status: reqQuery.registration_status && JSON.parse(String(reqQuery.registration_status)),
        event_status: reqQuery.event_status && JSON.parse(String(reqQuery.event_status))
    }

    const validation = validateObjectData(get_event_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: EventQuery = {
        soft_delete: false
    }

    if (reqQuery.search) {
        where.$or = [{ name: { $regex: String(reqQuery.search), $options: 'i' } }];
    }
    reqQuery.id && (where._id = new Types.ObjectId(String(reqQuery.id)));
    var regExp = new RegExp("true");
    if (reqQuery.is_active && Array.isArray(reqQuery.is_active) && reqQuery.is_active.length != 0) {
        const active_status = reqQuery.is_active.map((status) => {
            return regExp.test(String(status));
        });
        where.is_active = { $in: active_status }
    }

    if (reqQuery.registration_status && Array.isArray(reqQuery.registration_status) && reqQuery.registration_status.length != 0) {
        let status = reqQuery.registration_status.map((status) => {
            return String(status);
        });
        where.registration_status = { $in: status }
    }

    if (reqQuery.event_status && Array.isArray(reqQuery.event_status) && reqQuery.event_status.length != 0) {
        let status = reqQuery.event_status.map((status) => {
            return String(status);
        });
        where.event_status = { $in: status }
    }

    const sortOptions: string | { [key: string]: SortOrder | { $meta: any; }; } | [string, SortOrder][] | null | undefined = [];
    if (reqQuery.orderBy) {
        sortOptions.push([String(reqQuery.orderBy), reqQuery.sort === 'asc' ? 1 : -1]);
    } else {
        sortOptions.push(["createdAt", -1]);
    }

    const events = (await Event.find(where)
        .populate({ path: 'grounds', select: 'name', options: { strictPopulate: false }, populate: { path: 'venue', select: 'name', options: { strictPopulate: false } } })
        .populate({ path: 'sports', select: 'name', options: { strictPopulate: false } })
        .populate({ path: 'slots', select: 'slot', options: { strictPopulate: false } })
        .sort(sortOptions)
        .skip(Number(reqQuery.offset) || 0)
        .limit(Number(reqQuery.limit) || 10000))
        .map((event) => {
            const total_income = event.income.reduce((amount: number, income: any) => {
                return amount + income.amount;
            }, 0);
            const total_expense = event.expenses.reduce((amount: number, exp: any) => {
                return amount + exp.amount;
            }, 0);
            const total = total_income - total_expense;
            let update_allowed = true;
            const twoDaysLater = new Date(event.end_date.getTime() + 2 * 24 * 60 * 60 * 1000);
            if (new Date() > twoDaysLater) {
                update_allowed = false;
            }
            const lastDateToUpdate = new Date(twoDaysLater);
            return {
                id: event._id,
                name: event.name,
                duration: event.duration,
                start_date: event.start_date.toLocaleString(),
                end_date: event.end_date.toLocaleString(),
                image: event.image,
                registration_status: event.registration_status,
                event_status: event.event_status,
                is_active: event.is_active,
                grounds: event.grounds,
                sports: event.sports,
                slots: event.slots,
                in_profit: total < 0 ? false : true,
                income: event.income,
                expenses: event.expenses,
                description: event.description,
                "net_profit/loss": total,
                total_income,
                total_expense,
                update_allowed,
                last_date_to_update: lastDateToUpdate.toDateString()
            }
        });

    const count = await Event.countDocuments(where);

    const response = response200("All events fetched successfully", { count, events });
    return res.status(response[0]).json(response[1]);
}));

router.post('/update-event', [verifyJWT, update(menus.EVENTS)], asyncHandler(async (req: Request, res: Response) => {
    let reqData = req.body;
    reqData = {
        ...reqData,
        grounds: reqData.grounds && JSON.parse(reqData.grounds),
        slots: reqData.slots && JSON.parse(reqData.slots),
        expenses: reqData.expenses && JSON.parse(reqData.expenses),
        income: reqData.income && JSON.parse(reqData.income)
    }
    const reqImage = req.files;

    const validation = validateObjectData(update_event_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if (Array.isArray(reqImage) && reqImage?.length != 0) {
        const imgValidation = validateObjectData(image_validation_schema, reqImage[0]);
        if (imgValidation.error) throw new CustomError(imgValidation.error.message, 406, imgValidation.error.details[0].context?.key);
    }

    const event = await Event.findOne({ _id: reqData.id, soft_delete: false });
    if (!event) throw new CustomError("No event found", 406,);

    if (new Date() > new Date(event.end_date)) throw new CustomError("Event cannot be updated after event's end time", 406);

    const twoDaysLater = new Date(event.end_date.getTime() + 2 * 24 * 60 * 60 * 1000);
    if (new Date() > twoDaysLater && (reqData.income || reqData.expenses)) throw new CustomError("Financial data cannot be updated after two days from the event's end time.", 406);

    if (reqData.start_date && reqData.end_date) {
        let start_date = new Date(reqData.start_date)
        let end_date = new Date(reqData.end_date)

        if (end_date < start_date) throw new CustomError("Invalid dates", 406);
    }

    const data = {
        name: reqData?.name,
        duration: reqData?.duration,
        start_date: reqData?.start_date,
        end_date: reqData?.end_date,
        grounds: reqData?.grounds,
        sports: reqData?.sports,
        registration_status: reqData?.registration_status,
        event_status: reqData?.event_status,
        is_active: reqData?.is_active,
        image: reqData?.img_url,
        slots: reqData?.slots,
        income: reqData?.income,
        expenses: reqData?.expenses,
        description: reqData.description
    }

    if ('image' in reqData && typeof reqData.image == 'string' && reqData.image.length == 0) {
        await removeFile(uploadPaths.events, reqData.id);
        data.image = ""
    }

    if (reqData.start_date) {
        let start_date = new Date(reqData.start_date)
        start_date.setHours(0);
        start_date.setMinutes(0);
        start_date.setSeconds(0);
        start_date.setMilliseconds(0);

        data.start_date = start_date;

        if (start_date > event.end_date) throw new CustomError("Invalid dates", 406);
    }
    else {
        delete data.start_date;
    }

    if (reqData.end_date) {
        let end_date = new Date(reqData.end_date)
        end_date.setHours(23);
        end_date.setMinutes(59);
        end_date.setSeconds(59);
        end_date.setMilliseconds(999);

        data.end_date = end_date;

        if (event.start_date > end_date) throw new CustomError("Invalid dates", 406);
    }
    else {
        delete data.end_date;
    }

    if ('image' in reqData && typeof reqData.image == 'string' && reqData.image.length == 0) {
        await removeFile(uploadPaths.events, reqData.id);
        data.image = ""
    }
    else if (Array.isArray(reqImage) && reqImage.length != 0) {
        await removeFile(uploadPaths.events, reqData.id);
        const compressedBuffer = await new Promise<Buffer>((resolve, reject) => {
            sharp(reqImage[0].buffer as Buffer)
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
        await saveImage(uploadPaths.events, `${event._id}-event-${reqImage[0].originalname}`, compressedBuffer);
        let url = await findFile(event._id, uploadPaths.events);
        data.image = url[0];
    }
    else {
        delete data.image
    }

    await Event.updateOne(
        { _id: reqData.id },
        { $set: data }
    );

    const response = response200("Event updated successfully", {});
    return res.status(response[0]).json(response[1]);
}));

router.post('/remove-events', [verifyJWT, remove(menus.EVENTS)], asyncHandler(async (req: Request, res: Response) => {
    const reqIds = req.body.eventIds;

    const validation = validateArrayData(remove_events_schema, reqIds);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    await Event.updateMany(
        { _id: reqIds },
        { $set: { soft_delete: true } }
    );

    const response = response200("Events deleted successfully", {});
    return res.status(response[0]).json(response[1]);
}));

router.get('/fetch-events', asyncHandler(async (req: Request, res: Response) => {
    let reqQuery = req.query;
    reqQuery = {
        ...reqQuery,
        is_active: reqQuery.is_active && JSON.parse(String(reqQuery.is_active)),
        registration_status: reqQuery.registration_status && JSON.parse(String(reqQuery.registration_status)),
        event_status: reqQuery.event_status && JSON.parse(String(reqQuery.event_status))
    }

    const validation = validateObjectData(get_event_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: EventQuery = {
        soft_delete: false
    }

    if (reqQuery.search) {
        where.$or = [{ name: { $regex: String(reqQuery.search), $options: 'i' } }];
    }
    reqQuery.id && (where._id = new Types.ObjectId(String(reqQuery.id)));
    var regExp = new RegExp("true");
    if (reqQuery.is_active && Array.isArray(reqQuery.is_active) && reqQuery.is_active.length != 0) {
        const active_status = reqQuery.is_active.map((status) => {
            return regExp.test(String(status));
        });
        where.is_active = { $in: active_status }
    }

    if (reqQuery.registration_status && Array.isArray(reqQuery.registration_status) && reqQuery.registration_status.length != 0) {
        let status = reqQuery.registration_status.map((status) => {
            return String(status);
        });
        where.registration_status = { $in: status }
    }

    if (reqQuery.event_status && Array.isArray(reqQuery.event_status) && reqQuery.event_status.length != 0) {
        let status = reqQuery.event_status.map((status) => {
            return String(status);
        });
        where.event_status = { $in: status }
    }

    const sortOptions: string | { [key: string]: SortOrder | { $meta: any; }; } | [string, SortOrder][] | null | undefined = [];
    if (reqQuery.orderBy) {
        sortOptions.push([String(reqQuery.orderBy), reqQuery.sort === 'asc' ? 1 : -1]);
    } else {
        sortOptions.push(["createdAt", -1]);
    }

    const events = (await Event.find(where)
        .populate({ path: 'grounds', select: 'name', options: { strictPopulate: false }, populate: { path: 'venue', select: ['name', 'address'], options: { strictPopulate: false } } })
        .populate({ path: 'sports', select: 'name', options: { strictPopulate: false } })
        .populate({ path: 'slots', select: 'slot', options: { strictPopulate: false } })
        .sort(sortOptions)
        .skip(Number(reqQuery.offset) || 0)
        .limit(Number(reqQuery.limit) || 10000))
        .map((event) => {
            return {
                id: event._id,
                name: event.name,
                duration: event.duration,
                start_date: event.start_date.toLocaleString(),
                end_date: event.end_date.toLocaleString(),
                image: event.image,
                registration_status: event.registration_status,
                event_status: event.event_status,        
                grounds: event.grounds,
                description: event.description,
                sports: event.sports,                                                                                                                                              
            }
        });

    const count = await Event.countDocuments(where);

    const response = response200("All events fetched successfully", { count, events });
    return res.status(response[0]).json(response[1]);
}));

export default router;