import { FilterQuery } from "mongoose";
import { Feedback } from "../schemas/schema";
import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { response200 } from "../lib/helpers/utils";
import { Request, Response, Router } from "express";
import verifyJWT from "../middlewares/authentication";
import { FeedbackTopic, IFeedback } from "../types/types";
import { menus, remove, view } from "../middlewares/permission";
import { validateArrayData, validateObjectData } from "../lib/helpers/validation";
import { add_feedback_schema, fetch_feedbacks_schema, remove_feedback_schema } from "../validation/feedbackValidation";

const router = Router();

interface FeedbackQuery extends FilterQuery<IFeedback> {
    soft_delete: boolean;
    topic?: FeedbackTopic;
}

router.post('/feedback', asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    const validation = validateObjectData(add_feedback_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    await Feedback.create({
        first_name: reqData.first_name,
        last_name: reqData.last_name,
        mobile: reqData.mobile,
        topic: reqData.topic,
        feedback: reqData.feedback
    });

    const response = response200("Feedback submitted", {});
    return res.status(response[0]).json(response[1]);
}));

router.get('/feedbacks', [verifyJWT, view(menus.Feedback)], asyncHandler(async (req: Request, res: Response) => {
    const reqQuery = req.query;

    const validation = validateObjectData(fetch_feedbacks_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: FeedbackQuery = {
        soft_delete: false
    };

    if (reqQuery.topic) {
        switch (reqQuery.topic) {
            case 'Pay & Play':
                where.topic = FeedbackTopic["PAY & PLAY"];
                break;
            case 'Academy':
                where.topic = FeedbackTopic.ACADEMY;
                break;
            case 'Membership':
                where.topic = FeedbackTopic.MEMBERSHIP;
                break;
            case 'Other':
                where.topic = FeedbackTopic.OTHER;
                break;
        }
    }

    const feedbacks = (await Feedback.find(where)
        .limit(Number(reqQuery.limit) || 10000)
        .skip(Number(reqQuery.offset) || 0)
        .sort({ createdAt: -1 })
    ).map(feedback => {
        return {
            id: feedback._id,
            name: `${feedback.first_name} ${feedback.last_name}`,
            mobile: feedback.mobile,
            topic: feedback.topic,
            feedback: feedback.feedback
        }
    });

    const count = await Feedback.countDocuments(where);

    const response = response200("Feedbacks fetched successfully", { count, feedbacks });
    return res.status(response[0]).json(response[1]);
}));

router.post('/remove-feedbacks', [verifyJWT, remove(menus.Feedback)], asyncHandler(async (req: Request, res: Response) => {
    const reqIds = req.body.feedbackIds;

    const validation = validateArrayData(remove_feedback_schema, reqIds);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    await Feedback.updateMany(
        { _id: { $in: reqIds } },
        { $set: { soft_delete: true } }
    );

    const response = response200(`${reqIds.length > 1 ? "Feedbacks" : "Feedback"} removed successfully`, {});
    return res.status(response[0]).json(response[1]);
}));

export default router;