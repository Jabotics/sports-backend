import { IInquiry } from "../types/types";
import { Inquiry } from "../schemas/schema";
import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { FilterQuery, SortOrder } from "mongoose";
import { response200 } from "../lib/helpers/utils";
import { Request, Response, Router } from "express";
import verifyJWT from "../middlewares/authentication";
import { menus, remove, update, view } from "../middlewares/permission";
import { validateArrayData, validateObjectData } from "../lib/helpers/validation";
import { add_inquiry_schema, get_all_inquiries_schema, remove_inquiry_schema, update_inquiry_schema } from "../validation/inquiryValidation";

interface InquiryQuery extends FilterQuery<IInquiry> {
    $or?: Array<{ [key: string]: any }>;
    is_active?: {
        $in: Array<Boolean>;
    };
    solved?: boolean;
    inquiry_type?: {
        $in: string[];
    }
}

const router = Router();

router.post('/add-inquiry', asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    const validation = validateObjectData(add_inquiry_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const newInquiry = new Inquiry({
        first_name: reqData.first_name,
        last_name: reqData.last_name,
        inquiry_type: reqData.inquiry_type,
        mobile: reqData.mobile,
        description: reqData.description
    });

    newInquiry.save();
    const response = response200("Inquiry submitted successfully, We will get you soon", {});
    return res.status(response[0]).json(response[1]);
}));

router.get('/get-all-inquiries', [verifyJWT, view(menus.Inquiries)], asyncHandler(async (req: Request, res: Response) => {
    let reqQuery = req.query;
    reqQuery = {
        ...reqQuery,
        is_active: req.query.is_active && JSON.parse(String(reqQuery.is_active)),
        inquiry_type: req.query.inquiry_type && JSON.parse(String(reqQuery.inquiry_type))
    }

    const validation = validateObjectData(get_all_inquiries_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    let where: InquiryQuery = {
    };

    if (reqQuery.search) {
        where.$or = [{ name: { $regex: String(reqQuery.search), $options: 'i' }, mobile: { $regex: String(reqQuery.search), $options: 'i' } }];
    }

    var regExp = new RegExp("true");
    if (reqQuery.is_active && Array.isArray(reqQuery.is_active) && reqQuery.is_active.length != 0) {
        const active_status = reqQuery.is_active.map((status) => {
            return regExp.test(String(status));
        });
        where.is_active = { $in: active_status }
    }
    reqQuery.solved && (where.solved = regExp.test(String(reqQuery.solved)));
    if(reqQuery.inquiry_type && Array.isArray(reqQuery.inquiry_type)) {
        let inquiry_types: string[] = [];
        reqQuery.inquiry_type.forEach(item=> {
            inquiry_types.push(String(item));
        });
        where.inquiry_type = {$in: inquiry_types}
    }

    const sortOptions: string | { [key: string]: SortOrder | { $meta: any; }; } | [string, SortOrder][] | null | undefined = [];

    if (reqQuery.orderBy) {
        sortOptions.push([String(reqQuery.orderBy), reqQuery.sort === 'asc' ? 1 : -1]);
    } else {
        sortOptions.push(["createdAt", 1]);
    }

    const inquiries = (await Inquiry.find(where)
        .sort(sortOptions)
        .skip(Number(reqQuery.offset))
        .limit(Number(reqQuery.limit))).map((inquiry) => {
            return {
                id: inquiry._id,
                first_name: inquiry.first_name,
                last_name: inquiry.last_name,
                mobile: inquiry.mobile,
                inquiry_type: inquiry.inquiry_type,
                solved: inquiry.solved,
                description: inquiry.description
            }
        });

    const count = await Inquiry.countDocuments(where);

    const response = response200("All inquiries fetched successfully", { count, inquiries });
    return res.status(response[0]).json(response[1]);
}));

router.post('/update-inquiry', [verifyJWT, update(menus.Inquiries)], asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    const validation = validateObjectData(update_inquiry_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    await Inquiry.findByIdAndUpdate(
        { _id: reqData.id },
        { $set: { solved: reqData.solved } }
    );

    const response = response200("Inquiry updated successfully", {});
    return res.status(response[0]).json(response[1]);
}));

router.post('/remove-inquiries', [verifyJWT, remove(menus.Inquiries)], asyncHandler(async (req: Request, res: Response) => {
    const reqIds = req.body.inquiryIds;

    const validation = validateArrayData(remove_inquiry_schema, reqIds);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    await Inquiry.deleteMany({ _id: { $in: reqIds } }).exec();

    const response = response200("Inquiry removed successfully", {});
    return res.status(response[0]).json(response[1]);
}));

export default router;