import sharp from "sharp";
import bcrypt from 'bcrypt';
import { CustomRequest } from "../server";
import { sendMail } from "../lib/helpers/mail";
import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { Response, Router, Request } from "express";
import verifyJWT from "../middlewares/authentication";
import { Gender, VerificationType } from "../types/types";
import { Admin, Employee, Verification } from "../schemas/schema";
import { generateEmailToken } from "../lib/helpers/authentication";
import { image_validation_schema } from "../validation/imageValidation";
import { validateObjectData, validateStringData } from "../lib/helpers/validation";
import { findFile, generateFrontEndURL, getUserData, removeFile, response200, saveImage, uploadPaths } from "../lib/helpers/utils";
import { change_password_schema, emp_profile_update_schema, forgot_password_schema, reset_password_schema } from "../validation/settingValidation";

const router = Router();

interface emp_data {
    first_name?: string;
    last_name?: string;
    address?: string;
    mobile?: string;
    profile_image?: string;
    gender?: Gender
}

router.post('/emp-profile-update', verifyJWT, asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqData = req.body;
    const user = req.user;
    const reqImage = req.files;
    const io = req.io;

    if (user && user.id != reqData.id) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(emp_profile_update_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if (Array.isArray(reqImage) && reqImage?.length != 0) {
        const imgValidation = validateObjectData(image_validation_schema, reqImage[0]);
        if (imgValidation.error) throw new CustomError(imgValidation.error.message, 406, imgValidation.error.details[0].context?.key);
    }

    if (reqData.mobile) {
        const emp_mobile = user && ('is_superadmin' in user || 'is_admin' in user || 'partner' in user) ? await Admin.find({ mobile: reqData.mobile }) : await Employee.find({ mobile: reqData.mobile });
        if (emp_mobile.length != 0 && user && emp_mobile[0]._id != user.id) {
            throw new CustomError("Mobile already in use by another employee", 406);
        }
    }

    const data: emp_data = {
        first_name: reqData?.first_name,
        last_name: reqData?.last_name,
        address: reqData?.address,
        mobile: reqData?.mobile,
        gender: reqData?.gender
    };

    if (Array.isArray(reqImage) && reqImage.length != 0) {
        await removeFile(uploadPaths.profile, reqData.id)
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
        await saveImage(uploadPaths.profile, `${reqData.id}-profile-${reqImage[0].originalname}`, compressedBuffer);
        let url = await findFile(reqData.id, uploadPaths.profile);
        data.profile_image = url[0];
    }

    if (data.profile_image === "") delete data.profile_image;

    user && ('is_superadmin' in user || 'is_admin' in user || 'partner' in user) ? await Admin.findByIdAndUpdate(
        { _id: reqData.id },
        { $set: data }
    ) : await Employee.findByIdAndUpdate(
        { _id: reqData.id },
        { $set: data }
    );

    if (io && user) {
        let payload = {
            id: user.id,
            type: ('is_superadmin' in user || 'is_admin' in user || 'partner' in user) ? "admin" : "regular"
        }
        const userData = await getUserData(payload.id, payload.type);
        io.emit("user_data", userData);
    }

    const response = response200("Profile updated successfully", {});
    return res.status(response[0]).json(response[1]);
}));

router.post('/forget-password', asyncHandler(async (req: Request, res: Response) => {
    const email = req.body.email;

    const validation = validateStringData(forgot_password_schema, email);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where = {
        email: email,
        soft_delete: false
    }

    const admin = await Admin.countDocuments(where);
    const emp = await Employee.countDocuments(where);
    if (admin == 0 && emp == 0) throw new CustomError("Email not registered", 403);

    let employee;
    if (admin != 0) {
        employee = await Admin.findOne(where);
    }
    else {
        employee = await Employee.findOne(where);
    }

    if (employee && !employee.email_verified) throw new CustomError("Email not verified", 403);

    if (employee) {
        const emailToken = await generateEmailToken();
        const verificationLink = await Verification.create({
            employeeId: employee._id,
            type: 'FORGOT_PASSWORD',
            token: emailToken
        });
        sendMail(employee.email, "Reset Password", "resetPassword", {
            firstName: employee.first_name,
            link: generateFrontEndURL("reset-password", employee.email, verificationLink.token, `${admin != 0 ? 'admin' : 'regular'}`)
        });

        const response = response200("Link sent, please check your email", {});
        return res.status(response[0]).json(response[1]);
    }
    else {
        throw new CustomError("Something went wrong", 400);
    }

}));

router.post('/reset-password', asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    const validation = validateObjectData(reset_password_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const verificationLink = await Verification.find({
        token: reqData.token,
        soft_delete: false
    });

    if (verificationLink.length == 0) throw new CustomError("Invalid or expired verification link.", 401);

    const employee = reqData.empType == 'regular' ? await Employee.find({ email: reqData.email }) : await Admin.find({ email: reqData.email });
    if (employee.length == 0) throw new CustomError("Permission denied", 403);

    if (verificationLink[0].employeeId != employee[0].id || verificationLink[0].type != VerificationType.FORGOT_PASSWORD) {
        throw new CustomError("Email and token mismatch", 409);
    }

    await Verification.deleteOne(
        { _id: verificationLink[0].id },
    );

    const hashedPassword = await bcrypt.hash(reqData.password, 10);
    reqData.empType == 'regular' ? await Employee.updateOne(
        { _id: employee[0]._id },
        { $set: { password: hashedPassword } }
    ) : await Admin.updateOne(
        { _id: employee[0]._id },
        { $set: { password: hashedPassword } }
    );

    const response = response200("Password updated successfully", {});
    return res.status(response[0]).json(response[1]);

}));

router.post('/change-password', verifyJWT, asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqData = req.body;
    const user = req.user;

    const validation = validateObjectData(change_password_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if (user && user.id !== reqData.id) throw new CustomError('Permission denied', 403);

    const employee = user && ('is_superadmin' in user || 'is_admin' in user || 'partner' in user)
        ? await Admin.findById({ _id: reqData.id })
        : await Employee.findById({ _id: reqData.id });

    if (!employee) throw new CustomError("Employee doesn't exists", 406);

    const matchPassword = employee.password && await bcrypt.compare(reqData.old_password, employee.password);
    if (!matchPassword) throw new CustomError("Old Password is incorrect!", 401);

    if (reqData.old_password == reqData.new_password) throw new CustomError("Old password and new password must not be same", 406);

    const hashedPassword = await bcrypt.hash(reqData.new_password, 10);

    user && ('is_superadmin' in user || 'is_admin' in user || 'partner' in user)
        ? await Admin.findByIdAndUpdate(
            { _id: reqData.id },
            { $set: { password: hashedPassword } }
        ) : await Employee.findByIdAndUpdate(
            { _id: reqData.id },
            { $set: { password: hashedPassword } }
        );

    const response = response200("Password updated successfully", {});
    return res.status(response[0]).json(response[1]);
}));

export default router;