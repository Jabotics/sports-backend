import config from 'config';
import jwt from 'jsonwebtoken';
import { CustomRequest } from "../server";
import { ICustomer } from "../types/types";
import { Types, FilterQuery } from "mongoose";
import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { Request, Response, Router } from "express";
import { Customer, Ground } from "../schemas/schema";
import verifyJWT from "../middlewares/authentication";
import { menus, view } from '../middlewares/permission';
import { validateObjectData } from "../lib/helpers/validation";
import { image_validation_schema } from '../validation/imageValidation';
import { findFile, removeFile, response200, response406, saveImage, uploadPaths } from "../lib/helpers/utils";
import { add_to_favorites_schema, customer_login_schema, customer_schema, get_customer_schema, update_user_profile, validate_otp_schema } from "../validation/customerValidation";

const router = Router();

const resetField = async (id: string) => {
    await Customer.updateOne(
        { _id: id },
        {
            $set: {
                otp: null,
                otp_time: null,
                attempt: 3
            }
        });
}

interface CustomerQuery extends FilterQuery<ICustomer> {
    $or?: Array<{ [key: string]: any }>;
    is_active?: boolean;
    _id?: Types.ObjectId;
    city?: Types.ObjectId;
}

router.post('/customer-login', asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    const validation = validateObjectData(customer_login_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const customer = await Customer.findOne({ mobile: reqData.mobile, is_active: true, soft_delete: false });

    if (customer && customer.otp && customer.attempt != 0) {
        const expirationTime = 30 * 1000;
        const currentTime = new Date().getTime();
        const difference = currentTime - Number(customer.otp_time);
        if (difference < expirationTime) {
            let response = response406("Resend OTP after 30 seconds");
            return res.status(response[0]).json(response[1]);
        }
    }

    let OTP: number | string = Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000;
    OTP = String(OTP).split(".")[0];
    let start_time = new Date().getTime();

    let user;
    if (!customer) {
        user = await Customer.create({
            first_name: '',
            last_name: '',
            email: null,
            mobile: reqData.mobile,
            otp: Number(OTP),
            otp_time: String(start_time),
            attempt: 3
        });
    }
    else {
        await Customer.updateOne(
            { _id: customer._id },
            {
                $set: {
                    otp: Number(OTP),
                    otp_time: String(start_time),
                    attempt: 3
                }
            }
        );
    }

    const response = response200("OTP sent to your phone number", { id: customer ? customer._id : user?._id, otp: Number(OTP) });
    return res.status(response[0]).json(response[1]);
}));

router.post('/validate-otp', asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    const validation = validateObjectData(validate_otp_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const customer = await Customer.findOne({ _id: reqData.id, is_active: true, soft_delete: false });
    if (!customer) throw new CustomError("Customer not found", 403);

    if (customer.attempt == 0) {
        resetField(customer._id);
        const response = response406("OTP expired, please resend OTP", { attempt: 0 });
        return res.status(response[0]).json(response[1]);
    }

    const expirationTime = 10 * 60 * 1000;
    const currentTime = new Date().getTime();
    const difference = currentTime - Number(customer.otp_time);
    if (difference >= expirationTime) {
        await resetField(customer._id);
        const response = response406("OTP expired, please resend OTP", {});
        return res.status(response[0]).json(response[1]);
    }

    if (reqData.otp != customer.otp) {
        await Customer.updateOne(
            { _id: reqData.id },
            { $set: { attempt: customer.attempt - 1 } }
        );
        let response = response406('Invalid OTP, please try again', { "attempt": customer.attempt - 1 });
        return res.status(response[0]).json(response[1]);
    }
    else {
        let payload = {
            id: customer._id,
            first_name: customer.first_name,
            last_name: customer.last_name,
            email: customer?.email,
            mobile: customer.mobile,      
            joined_academies: customer.joined_academies,
            joined_memberships: customer.joined_memberships,
            favorites: customer.favorites,
            profile_img: customer.profile_img
        }

        let secretkey = config.get('jwt_secretkey');
        if (!secretkey) throw new CustomError("JWT Secret key not defined", 500);

        //Generate jwt
        const token = `Bearer ${jwt.sign(payload, String(config.get('jwt_secretkey')), { expiresIn: '30d' })}`;
        res.setHeader("authorization", token);
        res.setHeader("Access-Control-Expose-Headers", "*");
        const response = response200("Login successful", { payload });
        resetField(customer._id);
        return res.status(response[0]).json(response[1]);
    }
}));

router.get('/get-all-customers', [verifyJWT, view(menus.Customers)], asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqQuery = req.query;
    const user = req.user;

    const validation = validateObjectData(get_customer_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if (!user) throw new CustomError("Permission denied", 403);

    const where: CustomerQuery = {
        soft_delete: false,
    }
    var regExp = new RegExp("true");
    reqQuery.is_active && (where.is_active = regExp.test(String(reqQuery.is_active)));
    reqQuery.search && (where.$or = [
        { name: { $regex: String(reqQuery.search), $options: 'i' } },
        { mobile: { $regex: String(reqQuery.search), $options: 'i' } },
    ]);

    // if ('city' in user && user.city != null) {
    //     where.city = new Types.ObjectId(String(user.city._id));
    // }    

    const customers = (await Customer.find(where)
        .skip(Number(reqQuery.offset))
        .limit(Number(reqQuery.limit))
        .populate({ path: 'city', select: 'name', options: { strictPopulate: false } })
    ).map((customer) => {
        return {
            id: customer._id,
            // name: customer.name,
            email: customer.email || null,
            mobile: customer.mobile,
            is_active: customer.is_active
        }
    });

    const count = await Customer.countDocuments(where);

    const response = response200("Customers fetched successfully", { count, customers });
    return res.status(response[0]).json(response[1]);
}));

router.post('/favorites', verifyJWT ,asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqData = req.body;
    const user = req.user;

    if(!user) throw new CustomError("Session expired, please login again", 403);

    const validation = validateObjectData(add_to_favorites_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);    

    const ground = await Ground.findOne({ _id: reqData.ground_id, is_active: true, soft_delete: false });
    if (!ground) throw new CustomError("Ground does not exist or disabled", 406);

    const customer = await Customer.findOne({ _id: user.id, is_active: true, soft_delete: false });
    if (!customer) throw new CustomError("Something went wrong", 406);

    const existInFav = customer.favorites.includes(reqData.ground_id);

    if (existInFav) {
        await Customer.findByIdAndUpdate(
            reqData.customer_id,
            { $pull: { favorites: reqData.ground_id } }
        );
    }
    else {
        await Customer.findByIdAndUpdate(
            reqData.customer_id,
            { $push: { favorites: reqData.ground_id } }
        )
    }

    const response = response200(existInFav ? "Removed from favorites" : "Added to favorites", { id: user.id });
    return res.status(response[0]).json(response[1]);
}));

router.post('/update-user-profile', verifyJWT ,asyncHandler(async (req: CustomRequest, res: Response)=>{
    const reqData = req.body;
    const user = req.user;
    const reqImages = req.files;
    
    if(!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(update_user_profile, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if (Array.isArray(reqImages) && reqImages?.length != 0) {
        const imgValidation = validateObjectData(image_validation_schema, reqImages[0]);
        if (imgValidation.error) throw new CustomError(imgValidation.error.message, 406, imgValidation.error.details[0].context?.key);
    }

    const customer = await Customer.findOne({_id: user.id, soft_delete: false});
    if(!customer) throw new CustomError("User not found, please login again", 404);
    var regExp = new RegExp("true");
    if(!regExp.test(String(customer.is_active))) throw new CustomError("Your account is disabled, please contact admin", 406);

    const data = {
        first_name: reqData?.first_name,
        last_name: reqData?.last_name,
        mobile: reqData?.mobile,
        profile_img: user.profile_img,
        email: reqData.email
    }

    if (Array.isArray(reqImages) && reqImages.length != 0) {
        await removeFile(uploadPaths.customers, reqData.id)
        for (let i in reqImages) {            
            await saveImage(uploadPaths.customers, `${user.id}-${reqImages[i].originalname}`, reqImages[i].buffer);
        }        
        let url = await findFile(user.id, uploadPaths.customers);
        let profile_img = url.find((img)=> img.includes("profile"));        
        data.profile_img = profile_img;
    }

    await Customer.findByIdAndUpdate(user.id, data);

    const response = response200("Profile updated", {id: user.id});
    return res.status(response[0]).json(response[1]);
}));

router.get('/verify-user-session', verifyJWT ,asyncHandler(async (req: CustomRequest, res: Response)=>{
    const user = req.user;

    if(!user) throw new CustomError("Session expired, please login again", 403);

    const customer = await Customer.findById(user.id);
    if(!customer) throw new CustomError("Session expired, please login again", 403);
    if(!customer.is_active) throw new CustomError("Your account is de-activated, please contact admin", 403);
    if(customer.soft_delete) throw new CustomError("User not found", 404);

    const payload = {
        id: customer._id,
        first_name: customer.first_name,
        last_name: customer.last_name,
        email: customer.email,
        mobile: customer.mobile,
        favorites: customer.favorites,
        profile_img: customer.profile_img,
        joined_academies: customer.joined_academies,
        joined_memberships: customer.joined_memberships,
    }

    const response = response200("Session verified", payload);
    return res.status(response[0]).json(response[1]);
}));

router.get('/customer', asyncHandler(async (req: Request, res: Response)=>{
    const reqQuery = req.query;

    const validation = validateObjectData(customer_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const user = await Customer.findById(reqQuery.id);

    const data = {
        id: user?._id,
        first_name: user?.first_name,
        last_name: user?.last_name,
        profile_img: user?.profile_img,
        mobile: user?.mobile
    }

    const response = response200("", data);
    return res.status(response[0]).json(response[1]);
}));

export default router;