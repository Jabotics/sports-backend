import { FilterQuery } from "mongoose";
import { IFAQs } from "../types/types";
import { FAQ } from "../schemas/schema";
import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { response200 } from "../lib/helpers/utils";
import { Request, Response, Router } from "express";
import verifyJWT from "../middlewares/authentication";
import { add, menus, remove, update, view } from "../middlewares/permission";
import { validateArrayData, validateObjectData } from "../lib/helpers/validation";
import { add_faq_schema, get_faq_schema, remove_faq_schema, update_faq_schema } from "../validation/faqValidation";

interface FaqQuery extends FilterQuery<IFAQs> {
    soft_delete: boolean;
    is_active?: {
        $in: boolean[];
    },
    type?: string;
}

const router = Router();

router.post('/add-faq', [verifyJWT, add(menus.Faq)], asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    const validation = validateObjectData(add_faq_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const faq = await FAQ.create({
        question: reqData.question,
        answer: reqData.answer,
        type: reqData.type
    });

    const response = response200("FAQ added successfully", { id: faq._id });
    return res.status(response[0]).json(response[1]);
}));

router.get('/get-faqs', [verifyJWT, view(menus.Faq)], asyncHandler(async (req: Request, res: Response) => {
    const reqQuery = req.query;

    const validation = validateObjectData(get_faq_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: FaqQuery = { soft_delete: false };
    var regExp = new RegExp("true");
    if (reqQuery.is_active && Array.isArray(reqQuery.is_active) && reqQuery.is_active.length != 0) {
        const active_status = reqQuery.is_active.map((status) => {
            return regExp.test(String(status));
        });
        where.is_active = { $in: active_status }
    }

    reqQuery.type && (where.type = String(reqQuery.type));

    const faqs = (await FAQ.find(where)
        .skip(Number(reqQuery.offset) || 0)
        .limit(Number(reqQuery.limit) || 10000)
    ).map(faq => {
        return {
            id: faq._id,
            question: faq.question,
            answer: faq.answer,
            type: faq.type,
            is_active: faq.is_active
        }
    });
    const count = await FAQ.countDocuments(where);

    const response = response200("FAQs fetched successfully", { count, faqs });
    return res.status(response[0]).json(response[1]);
}));

router.post('/update-faq', [verifyJWT, update(menus.Faq)], asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    const validation = validateObjectData(update_faq_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const data = {
        question: reqData?.question,
        answer: reqData?.answer,
        type: reqData?.type,
        is_active: reqData?.is_active
    };

    await FAQ.findByIdAndUpdate(reqData.id, data);

    const response = response200("FAQ updated successfully", { id: reqData.id });
    return res.status(response[0]).json(response[1]);
}));

router.post('/remove-faqs', [verifyJWT, remove(menus.Faq)], asyncHandler(async (req: Request, res: Response) => {
    const reqIds = req.body.faqIds;

    const validation = validateArrayData(remove_faq_schema, reqIds);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    await FAQ.updateMany(
        { _id: { $in: reqIds } },
        { $set: { soft_delete: true } }
    );

    const response = response200(`${reqIds.length > 1 ? "FAQs" : "FAQ"} removed successfully`, {});
    return res.status(response[0]).json(response[1]);
}));

//For User side
router.get('/faqs', asyncHandler(async (req: Request, res: Response) => {
    const reqQuery = req.query;

    const validation = validateObjectData(get_faq_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: FaqQuery = { soft_delete: false, is_active: { $in: [true] } };
    reqQuery.type && (where.type = String(reqQuery.type));

    const faqs = (await FAQ.find(where)
        .skip(Number(reqQuery.offset) || 0)
        .limit(Number(reqQuery.limit) || 10000)
    ).map(faq => {
        return {
            id: faq._id,
            question: faq.question,
            answer: faq.answer,
        }
    });

    const response = response200("FAQs", faqs);
    return res.status(response[0]).json(response[1]);
}));

export default router;