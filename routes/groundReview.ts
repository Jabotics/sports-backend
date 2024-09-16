import { CustomRequest } from "../server";
import { FilterQuery, Types } from "mongoose";
import { IGroundReview } from "../types/types";
import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { response200 } from "../lib/helpers/utils";
import { Request, Response, Router } from "express";
import verifyJWT from "../middlewares/authentication";
import { Ground, GroundReview } from "../schemas/schema";
import { menus, remove, view } from "../middlewares/permission";
import { validateArrayData, validateObjectData } from "../lib/helpers/validation";
import { add_review_validation, get_reviews_validation, remove_review_schema, review_validation, update_review_validation } from "../validation/groundReviewValidation";

const router = Router();

interface ReviewQuery extends FilterQuery<IGroundReview> {
    is_active?: {
        $in: Array<Boolean>;
    };
    ground?: {
        $in: Array<Types.ObjectId>
    }
}

function hideNumber(mobile: string) {
    return mobile.slice(-4).padStart(mobile.length, '*');
}

router.post('/add-ground-review', verifyJWT, asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqData = req.body;
    const user = req.user;

    if (!user) throw new CustomError("Session expired, please login again", 401);

    const validation = validateObjectData(add_review_validation, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    await GroundReview.create({
        customer: user.id,
        ground: reqData.ground,
        review: reqData.review,
        rating: reqData.rating,
        is_active: true,
    });

    const response = response200("Review submitted successfully", {});
    return res.status(response[0]).json(response[1]);
}));

router.get('/get-ground-reviews', [verifyJWT, view(menus.Ground_Review)], asyncHandler(async (req: Request, res: Response) => {
    const reqQuery = req.query;

    const validation = validateObjectData(get_reviews_validation, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: ReviewQuery = {
        soft_delete: false
    }

    var regExp = new RegExp("true");
    if (reqQuery.is_active && Array.isArray(reqQuery.is_active) && reqQuery.is_active.length != 0) {
        const active_status = reqQuery.is_active.map((status) => {
            return regExp.test(String(status));
        });
        where.is_active = { $in: active_status }
    }

    if (reqQuery.ground && Array.isArray(reqQuery.ground) && reqQuery.ground.length != 0) {
        const groundIds = reqQuery.ground.map((id) => {
            return new Types.ObjectId(String(id));
        });
        where.ground = { $in: groundIds }
    }

    const reviews = (await GroundReview.find(where)
        .populate({ path: 'customer', select: ['first_name', 'last_name', 'mobile'], options: { strictPopulate: false } })
        .populate({ path: 'ground', select: ['name'], options: { strictPopulate: false } })
        .limit(Number(reqQuery.limit) || 10000)
        .skip(Number(reqQuery.offset) || 0)
    )
        .map(review => {
            console.log(review)
            return {
                id: review._id,
                review: review.review,
                rating: review.rating,
                ground: review.ground,
                customer: review.customer,
                is_active: review.is_active,
            }
        });

    const count = await GroundReview.countDocuments(where);

    const response = response200("Reviews fetched successfully", { count, reviews });
    return res.status(response[0]).json(response[1]);
}));

router.post('/update-ground-review', verifyJWT, asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqData = req.body;
    const user = req.user;

    if (!user) throw new CustomError("Session expired, please login again", 401);

    const validation = validateObjectData(update_review_validation, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const review = await GroundReview.findOne({ _id: reqData.id, soft_delete: false });
    if (!review) throw new CustomError("No reviews found", 404);
    if (String(review.customer) != String(user.id)) throw new CustomError("Can't edit this comment", 403);
    // CHECK THIS PART: Also ALlow for super-admins

    const data: {
        review: string;
        rating: string;
        is_active: boolean
    } = {
        review: reqData?.review,
        rating: reqData?.rating,
        is_active: reqData?.is_active,
    }

    await GroundReview.findByIdAndUpdate(reqData.id, data);

    const response = response200("Review updated successfully", {});
    return res.status(response[0]).json(response[1]);
}));

router.post('/remove-ground-review', [verifyJWT, remove(menus.Ground_Review)], asyncHandler(async (req: Request, res: Response) => {
    const reqIds = req.body.reviewIds;

    const validation = validateArrayData(remove_review_schema, reqIds);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    await GroundReview.updateMany(
        { _id: { $in: reqIds } },
        { $set: { soft_delete: true } },
    );

    const response = response200("Review removed successfully", {});
    return res.status(response[0]).json(response[1]);
}));

router.get('/ground-reviews', asyncHandler(async (req: Request, res: Response) => {
    const reqQuery = req.query;

    const validation = validateObjectData(review_validation, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: ReviewQuery = {
        soft_delete: false,
        ground: {
            $in: [new Types.ObjectId(String(reqQuery.ground))]
        }
    }

    const reviews = (await GroundReview.find(where)
        .populate({ path: 'customer', select: ['first_name', 'last_name', 'mobile'], options: { strictPopulate: false } })
        .populate({ path: 'ground', select: ['name'], options: { strictPopulate: false } })
        .limit(Number(reqQuery.limit) || 10000)
        .skip(Number(reqQuery.offset) || 0)
    )
        .map(review => {
            let customer = {
                name: review.customer && 'first_name' in review.customer && 'last_name' in review.customer && `${review.customer.first_name} ${review.customer.last_name}`,
                mobile: review.customer && 'mobile' in review.customer && hideNumber((String(review.customer.mobile)))
            }
            return {
                id: review._id,
                review: review.review,
                rating: review.rating,
                ground: review.ground,
                customer,
            }
        });

    const count = await GroundReview.countDocuments(where);

    const response = response200("Reviews fetched successfully", { count, reviews });
    return res.status(response[0]).json(response[1]);
}));

export default router;