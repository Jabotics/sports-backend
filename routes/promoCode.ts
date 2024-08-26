import { CustomRequest } from "../server";
import { FilterQuery, Types } from "mongoose";
import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { response200 } from "../lib/helpers/utils";
import { Request, Response, Router } from "express";
import verifyJWT from "../middlewares/authentication";
import { IPromoCode, PromoCodeApplicableFor } from "../types/types";
import { Ground, Membership, PromoCode, Venue } from "../schemas/schema";
import { add, menus, remove, update, view } from "../middlewares/permission";
import { validateArrayData, validateObjectData } from "../lib/helpers/validation";
import { apply_promo_schema, create_promocode_schema, get_promocode_schema, remove_promocode_schema, update_promocode_schema } from "../validation/promoCodeValidation";

const router = Router();

interface PromoCodeQuery extends FilterQuery<IPromoCode> {
    $or?: Array<{ [key: string]: any }>;
    is_active?: {
        $in: Array<Boolean>;
    };
    grounds?: {
        $in: Array<Types.ObjectId>;
    };
    venue?: {
        $in: Array<Types.ObjectId>;
    };
    city?: Types.ObjectId;
}

router.post('/create-promo-code', [verifyJWT, add(menus.Promo_Codes)] ,asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqData = req.body;
    const user = req.user;

    if (!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(create_promocode_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if(reqData.applicable_for == 'Academy' && (!reqData.academies || (reqData.academy && Array.isArray(reqData.academy) && reqData.academy.length == 0))) throw new CustomError("Academy is required", 406);

    // if(reqData.applicable_for == 'Membership' && (!reqData.memberships || (reqData.membership && Array.isArray(reqData.membership) && reqData.membership.length == 0))) throw new CustomError("Membership is required", 406);

    if ('venue' in user && Array.isArray(user.venue) && user.venue.length != 0 && !user.venue.includes(reqData.venue)) throw new CustomError("Permission denied", 403);
    if ('ground' in user && Array.isArray(user.ground) && user.ground.length != 0 && !user.ground.includes(reqData.ground)) throw new CustomError("Permission denied", 403);

    const promo = await PromoCode.findOne({ code: reqData.code.toUpperCase(), soft_delete: false });
    if (promo) throw new CustomError("Promo code already exists", 406);

    const venue = await Venue.findOne({ _id: reqData.venue, is_active: true, soft_delete: false });
    if (!venue) throw new CustomError("Venue does not exist or is disabled", 406);

    if(reqData.grounds && Array.isArray(reqData.grounds)){
        const grounds = await Ground.find({ _id: {$in: reqData.grounds}, is_active: true, soft_delete: false });
        if(grounds.length == 0) throw new CustomError("Grounds does not exist or is disabled", 406);
        if (grounds.length != reqData.grounds.length) throw new CustomError("Grounds does not exist or is disabled", 406);
    }

    const currentDate = new Date();
    const valid_upto = new Date(reqData.valid_upto);

    if (valid_upto <= currentDate) throw new CustomError("Invalid expiration date", 406);

    valid_upto.setHours(23);
    valid_upto.setMinutes(59);
    valid_upto.setSeconds(59);
    valid_upto.setMilliseconds(999);

    const data = {
        code: reqData.code,
        city: reqData.city,
        venue: reqData.venue,
        valid_upto: valid_upto,
        grounds: reqData.grounds,
        academies: reqData?.academies,
        memberships: [""],
        max_use_limit: reqData.max_use_limit,
        minimum_amount: reqData.minimum_amount,
        applicable_for: reqData.applicable_for,
        discount_amount: reqData.discount_amount,
        discount_percentage: reqData.discount_percentage,
        terms_and_conditions: reqData.terms_and_conditions,
    }

    if(reqData.applicable_for == 'Membership') {
        const memberships = (await Membership.find({ground: {$in: [reqData.grounds]}})).map(membership=> String(membership._id));
        if(memberships.length != 0) {
            data.memberships = memberships;
        }
        else {
            data.memberships = [];
            throw new CustomError("Membership is not available for this ground", 406);
        }
    }

    const newPromoCode = await PromoCode.create(data);

    const response = response200("Promo code created successfully", { id: newPromoCode._id });
    return res.status(response[0]).json(response[1]);
}));

router.get('/get-promo-codes', [verifyJWT, view(menus.Promo_Codes)], asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqQuery = req.query;
    const user = req.user;

    if (!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(get_promocode_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: PromoCodeQuery = {
        soft_delete: false,
    }

    if (reqQuery.ground && Array.isArray(reqQuery.ground) && reqQuery.ground.length != 0) {
        const groundIds = reqQuery.ground.map((id) => {
            return new Types.ObjectId(String(id));
        });
        where.grounds = { $in: groundIds }
    }

    if (reqQuery.venue && Array.isArray(reqQuery.venue) && reqQuery.venue.length != 0) {
        const venueIds = reqQuery.venue.map((id) => {
            return new Types.ObjectId(String(id));
        });
        where.venue = { $in: venueIds }
    }

    if('city' in user && user.city) {
        where.city = new Types.ObjectId(String(user.city._id));
    }

    if ('ground' in user && Array.isArray(user.ground) && user.ground.length != 0) {
        const groundIds = user.ground.map((id) => {
            return new Types.ObjectId(String(id));
        });
        where.grounds = { $in: groundIds }
    }

    if ('venue' in user && Array.isArray(user.venue) && user.venue.length != 0) {
        const venueIds = user.venue.map((id) => {
            return new Types.ObjectId(String(id));
        });
        where.venue = { $in: venueIds }
    }
    reqQuery.city && (where.city = new Types.ObjectId(String(reqQuery.city)));

    reqQuery.search && (where.$or = [
        {code: {$regex: String(reqQuery.search), $options: 'i'}}
    ]);

    const promoCodes = (await PromoCode.find(where)
        .populate({ path: 'grounds', select: 'name', options: { strictPopulate: false } })
        .populate({ path: 'venue', select: 'name', options: { strictPopulate: false } })
        .skip(Number(reqQuery.offset) || 0)
        .limit(Number(reqQuery.limit) || 10000)
    ).map((code) => {
        return {
            id: code._id,
            code: code.code,
            venue: code.venue,
            grounds: code.grounds,
            academies: code.academies,
            memberships: code.memberships,
            max_use_limit: code.max_use_limit,
            minimum_amount: code.minimum_amount,
            applicable_for: code.applicable_for,
            discount_amount: code.discount_amount,
            valid_upto: code.valid_upto.toDateString(),
            discount_percentage: code.discount_percentage,
            terms_and_conditions: code.terms_and_conditions,
            is_active: code.is_active
        }
    });

    const count = await PromoCode.countDocuments(where);

    const response = response200("Promo codes fetched successfully", { count, promoCodes });
    return res.status(response[0]).json(response[1]);

}));

router.post('/update-promo-code', [verifyJWT, update(menus.Promo_Codes)], asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqData = req.body;
    const user = req.user;

    if (!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(update_promocode_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if ('venue' in user && Array.isArray(user.venue) && user.venue.length != 0 && !user.venue.includes(reqData.venue)) throw new CustomError("Permission denied", 403);
    if ('ground' in user && Array.isArray(user.ground) && user.ground.length != 0 && !user.ground.includes(reqData.ground)) throw new CustomError("Permission denied", 403);

    const promo = await PromoCode.find({ _id: reqData.id, soft_delete: false });
    if (!promo) throw new CustomError("Promo code not found", 406);

    if (reqData.venue) {
        const venue = await Venue.findOne({ _id: reqData.venue, is_active: true, soft_delete: false });
        if (!venue) throw new CustomError("Venue does not exist or is disabled", 406);
    }
    if (reqData.grounds && Array.isArray(reqData.grounds)) {
        const grounds = await Ground.find({ _id: {$in: reqData.grounds}, is_active: true, soft_delete: false });
        if(grounds.length == 0) throw new CustomError("Grounds does not exist or is disabled", 406);
        if (grounds.length != reqData.grounds.length) throw new CustomError("Grounds does not exist or is disabled", 406);
    }

    const data = {
        code: reqData?.code,
        venue: reqData?.venue,
        grounds: reqData?.grounds,
        academies: reqData?.academies,
        valid_upto: reqData?.valid_upto,
        memberships: reqData?.memberships,
        max_use_limit: reqData?.max_use_limit,
        applicable_for: reqData?.applicable_for,
        minimum_amount: reqData?.minimum_amount,
        discount_amount: reqData?.discount_amount,
        discount_percentage: reqData?.discount_percentage,
        terms_and_conditions: reqData?.terms_and_conditions,
    }

    if (reqData.valid_upto) {
        const currentDate = new Date();
        const valid_upto = new Date(reqData.valid_upto);

        if (valid_upto <= currentDate) throw new CustomError("Invalid expiration date", 406);

        valid_upto.setHours(23);
        valid_upto.setMinutes(59);
        valid_upto.setSeconds(59);
        valid_upto.setMilliseconds(999);

        data.valid_upto = valid_upto;
    }

    await PromoCode.findByIdAndUpdate(reqData.id, data);

    const response = response200("Promo code updated successfully", { id: reqData.id });
    return res.status(response[0]).json(response[1]);
}));

router.post('/remove-promo-codes', [verifyJWT, remove(menus.Promo_Codes)], asyncHandler(async (req: Request, res: Response) => {
    const reqIds = req.body.promoCodeIds;

    const validation = validateArrayData(remove_promocode_schema, reqIds);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    await PromoCode.updateMany(
        { _id: { $in: reqIds } },
        { $set: { soft_delete: true } },
    );

    const response = response200("Promo codes removed successfully", {});
    return res.status(response[0]).json(response[1]);
}));

//For user side
router.get('/promo-codes', asyncHandler(async (req: Request, res: Response) => {
    const reqQuery = req.query;

    const validation = validateObjectData(get_promocode_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: PromoCodeQuery = {
        soft_delete: false,
        is_active: {
            $in: [true]
        }
    }

    let date = new Date();

    date.setHours(23);
    date.setMinutes(59);
    date.setSeconds(59);
    date.setMilliseconds(999);

    where.valid_upto = {$gte: date}

    reqQuery.ground && (where.grounds = {$in: [new Types.ObjectId(String(reqQuery.ground))]});
    reqQuery.academy && (where.academies = {$in: [String(reqQuery.academy)]});
    reqQuery.membership && (where.memberships = {$in: [String(reqQuery.membership)]});

    if (reqQuery.venue && Array.isArray(reqQuery.venue) && reqQuery.venue.length != 0) {
        const venueIds = reqQuery.venue.map((id) => {
            return new Types.ObjectId(String(id));
        });
        where.venue = { $in: venueIds }
    }
    reqQuery.city && (where.city = new Types.ObjectId(String(reqQuery.city)));

    const promoCodes = (await PromoCode.find(where)
        .populate({ path: 'ground', select: 'name', options: { strictPopulate: false } })
        .populate({ path: 'venue', select: 'name', options: { strictPopulate: false } })
        .skip(Number(reqQuery.offset) || 0)
        .limit(Number(reqQuery.limit) || 10000)
    ).map((code) => {
        return {
            id: code._id,
            code: code.code,
            minimum_amount: code.minimum_amount,
            discount_amount: code.discount_amount,
            discount_percentage: code.discount_percentage,
            max_use_limit: code.max_use_limit,
            valid_upto: code.valid_upto.toDateString(),
            terms_and_conditions: code.terms_and_conditions,
        }
    });

    const count = await PromoCode.countDocuments(where);

    const response = response200("", promoCodes);
    return res.status(response[0]).json(response[1]);
}));

router.post('/apply-promo', asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    const validation = validateObjectData(apply_promo_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const promo = await PromoCode.findOne({ grounds: reqData.ground, _id: reqData.id ,soft_delete: false });
    if (!promo) throw new CustomError("Promo code is not applicable for this ground", 406);

    //validation for academies
    if(promo.applicable_for != PromoCodeApplicableFor.ACADEMY && reqData.academy) throw new CustomError("Promo code is not applicable for academies", 406);
    if(reqData.academy && !promo.academies.includes(reqData.academy)) throw new CustomError("Promo code is not applicable for this academy", 406);

    //validation for memberships
    if(promo.applicable_for != PromoCodeApplicableFor.MEMBERSHIP && reqData.membership) throw new CustomError("Promo code is not applicable for memberships", 406);
    if(reqData.membership && !promo.academies.includes(reqData.membership)) throw new CustomError("Promo code is not applicable for this membership", 406);

    const currentDate = new Date();
    if (promo.valid_upto < currentDate) throw new CustomError("Promo code expired", 406);

    let discount = 0;
    if (promo.discount_percentage != 0) {
        discount = Math.round((Number(reqData.amount) * promo.discount_percentage) / 100);     
        if (discount > promo.discount_amount) {
            discount = promo.discount_amount;
        }
    } else {
        discount = promo.discount_amount;
    }

    const amountAfterDiscount = Math.round(reqData.amount - discount);

    const response = response200("", { amount: amountAfterDiscount, discount });
    return res.status(response[0]).json(response[1]);
}));

export default router;