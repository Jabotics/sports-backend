import bcrypt from 'bcrypt';
import { FilterQuery } from "mongoose";
import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { response200 } from "../lib/helpers/utils";
import { Request, Response, Router } from "express";
import verifyJWT from "../middlewares/authentication";
import { Admin, PartnerRequest } from "../schemas/schema";
import { validateObjectData } from "../lib/helpers/validation";
import { menus, update, view } from "../middlewares/permission";
import { IPartnerRequest, PartnerRequestStatus } from "../types/types";
import { become_partner_validation, get_partner_request, update_partner_request } from "../validation/partnerValidation";

const router = Router();

interface RequestQuery extends FilterQuery<IPartnerRequest> {
    _id?: string;
    approved?: {
        $in: boolean[];
    }
    soft_delete: boolean;
}

router.post('/become-partner', asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    const validation = validateObjectData(become_partner_validation, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const newRequest = new PartnerRequest({
        first_name: reqData.first_name,
        last_name: reqData.last_name,
        email: reqData.email,
        mobile: reqData.mobile,
        venue_name: reqData.venue_name,
        address: reqData.address,
        city: reqData.city
    });
    await newRequest.save();

    const response = response200("Request submitted successfully, We will contact you soon", {});
    return res.status(response[0]).json(response[1]);
}));

router.get('/get-partner-requests', [verifyJWT, view(menus.Partner_Request)], asyncHandler(async (req: Request, res: Response) => {
    const reqQuery = req.query;

    const validation = validateObjectData(get_partner_request, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: RequestQuery = { soft_delete: false };

    var regExp = new RegExp("true");
    if (reqQuery.approved && Array.isArray(reqQuery.approved) && reqQuery.approved.length != 0) {
        const approve_status = reqQuery.approved.map((status) => {
            return regExp.test(String(status));
        });
        where.approved = { $in: approve_status }
    }
    reqQuery.city && (where.city = String(reqQuery.city));

    const requests = (await PartnerRequest.find(where)
        .populate({ path: 'city', select: ['name', '-_id'], options: { strictPopulate: false } })
        .limit(Number(reqQuery.limit) || 10000)
        .skip(Number(reqQuery.offset) || 0)
    )
        .map(request => {
            return {
                id: request._id,
                first_name: request.first_name,
                last_name: request.last_name,
                email: request.email,
                mobile: request.mobile,
                venue_name: request.venue_name,
                city: request.city,
                address: request.address,
                status: request.request_status
            }
        });

    const count = await PartnerRequest.countDocuments(where);

    const response = response200("Partner request fetched successfully", { count, requests });
    return res.status(response[0]).json(response[1]);
}));

router.post('/update-request', [verifyJWT, update(menus.Partner_Request)], asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    //Partner request data validation
    const validation = validateObjectData(update_partner_request, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if (reqData.status == PartnerRequestStatus.ACCEPTED && (!reqData.first_name || !reqData.last_name || !reqData.email || !reqData.mobile || !reqData.password)) throw new CustomError("Partner details is required", 406);

    const request = await PartnerRequest.findById(reqData.id);
    if (!request || request.soft_delete) throw new CustomError("No request found", 404);

    if (request.request_status === PartnerRequestStatus.ACCEPTED || request.request_status === PartnerRequestStatus.REJECTED) throw new CustomError("Request already updated", 406);

    if (reqData.status == PartnerRequestStatus.ACCEPTED) {
        const partner = await Admin.findOne({ email: reqData.email, soft_delete: false });
        if (partner) throw new CustomError("Email already exists", 406);

        const hashedPassword = await bcrypt.hash(reqData.password, 10);
        await Admin.create({
            first_name: reqData.first_name,
            last_name: reqData.last_name,
            email: reqData.email,
            mobile: reqData.mobile,
            password: hashedPassword
        });
    }

    await PartnerRequest.findByIdAndUpdate(reqData.id, { request_status: reqData.status });

    const response = response200("Request updated successfully", { id: reqData.id });
    return res.status(response[0]).json(response[1]);
}));

export default router;