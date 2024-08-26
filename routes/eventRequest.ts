import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { response200 } from "../lib/helpers/utils";
import { Request, Response, Router } from "express";
import verifyJWT from "../middlewares/authentication";
import { menus, view } from "../middlewares/permission";
import { Event, EventRequest } from "../schemas/schema";
import { validateObjectData } from "../lib/helpers/validation";
import { add_event_request } from "../validation/eventRequestValidation";

const router = Router();

router.post('/add-event-request', asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    const validation = validateObjectData(add_event_request, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const event = await Event.findOne({ _id: reqData.event, is_active: true, soft_delete: false, event_status: 'Upcoming' });
    if (!event) throw new CustomError("Something went wrong", 400);

    await EventRequest.create({
        event: reqData.event,
        name: reqData.name,
        mobile: reqData.mobile
    });

    const response = response200("Request submitted, we will contact you soon", {});
    return res.status(response[0]).json(response[1]);
}));

router.get('/get-event-requests', [verifyJWT, view(menus.EVENT_REQUEST)] ,asyncHandler(async (req: Request, res: Response) => {
    const requests = (await EventRequest.find({ soft_delete: false })
        .populate({ path: 'event', select: 'name', options: { strictPopulate: false } })
    )
    .map((request)=>{
        return {
            id: request._id,
            name: request.name,
            event: request.event,
            mobile: request.mobile,
            is_active: request.is_active,            
        }
    });

    const count = await EventRequest.countDocuments({soft_delete: false});

    const response = response200("Event fetched successfully", {count, requests});
    return res.status(response[0]).json(response[1]);
}));

export default router;