import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { HappyCustomer } from "../schemas/schema";
import { response200 } from "../lib/helpers/utils";
import { Request, Response, Router } from "express";
import verifyJWT from "../middlewares/authentication";
import { add, menus, remove, update, view } from "../middlewares/permission";
import { validateArrayData, validateObjectData } from "../lib/helpers/validation";
import { add_happy_customer, get_happy_customers, remove_happy_customers, update_happy_customer } from "../validation/happyCustomerValidation";

const router = Router();

router.post('/add-review', [verifyJWT, add(menus.Happy_Customers)], asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    const validation = validateObjectData(add_happy_customer, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const review = await HappyCustomer.create({
        name: reqData.name,
        review: reqData.review
    });

    const response = response200("Review added successfully", { id: review._id });
    return res.status(response[0]).json(response[1]);
}));

router.get('/get-reviews', [verifyJWT, view(menus.Happy_Customers)], asyncHandler(async (req: Request, res: Response) => {
    const reqQuery = req.query;

    const validation = validateObjectData(get_happy_customers, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where = {
        soft_delete: false
    }
    const reviews = (await HappyCustomer.find(where)
        .limit(Number(reqQuery.limit) || 10000)
        .skip(Number(reqQuery.offset) || 0)
    ).map(review => {
        return {
            id: review._id,
            name: review.name,
            review: review.review,
            is_active: review.is_active
        }
    });

    const count = await HappyCustomer.countDocuments(where);

    const response = response200("Reviews fetched successfully", { count, reviews });
    return res.status(response[0]).json(response[1]);
}));

router.post('/update-review', [verifyJWT, update(menus.Happy_Customers)], asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    const validation = validateObjectData(update_happy_customer, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const data = {
        name: reqData?.name,
        review: reqData?.review,
        is_active: reqData?.is_active
    }

    await HappyCustomer.findByIdAndUpdate(reqData.id, data);

    const response = response200("Review updated successfully", { id: reqData.id });
    return res.status(response[0]).json(response[1]);
}));

router.post('/remove-reviews', [verifyJWT, remove(menus.Happy_Customers)], asyncHandler(async (req: Request, res: Response) => {
    const reqIds = req.body.reviewIds;

    const validation = validateArrayData(remove_happy_customers, reqIds);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    await HappyCustomer.updateMany(
        { _id: { $in: reqIds } },
        { $set: { soft_delete: true } }
    );

    const response = response200(`${reqIds.length > 1 ? "Reviews" : "Review"} removed successfully`, {});
    return res.status(response[0]).json(response[1]);
}));

//For user side
router.get('/happy-customers', asyncHandler(async (req: Request, res: Response) => {
    const where = {
        soft_delete: false,
        is_active: true
    }
    const reviews = (await HappyCustomer.find(where)
        .limit(10)
        .skip(0)
        .sort({ createdAt: -1 })
    ).map(review => {
        return {
            id: review._id,
            name: review.name,
            review: review.review,
        }
    });

    const response = response200("", reviews);
    return res.status(response[0]).json(response[1]);
}));

export default router;