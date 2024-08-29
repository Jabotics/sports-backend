import { IAdmin } from "../types/types";
import { CustomRequest } from "../server";
import { sendMail } from "../lib/helpers/mail";
import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { Request, Response, Router } from "express";
import verifyJWT from "../middlewares/authentication";
import { FilterQuery, SortOrder, Types } from "mongoose";
import { add_employee_schema } from "../validation/empValidation";
import { generateEmailToken } from "../lib/helpers/authentication";
import { Admin, City, Venue, Verification } from "../schemas/schema";
import { generateFrontEndURL, response200 } from "../lib/helpers/utils";
import { add, menus, remove, update, view } from "../middlewares/permission";
import { validateArrayData, validateObjectData } from "../lib/helpers/validation";
import { add_admin_schema, add_subadmin_schema, get_all_admins_schema, remove_admin_schema, update_admin_schema, update_subadmin_schema } from "../validation/adminValidation";


interface AdminQuery extends FilterQuery<IAdmin> {
    $or?: Array<{ [key: string]: any }>;
    is_active?: boolean;
    _id?: Types.ObjectId;
}
const router = Router();

router.post('/add-authority-member', [verifyJWT, add(menus.Admins)], asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;
    const type = req.headers.type;

    if (!type) throw new CustomError("Type is required", 406);

    //Validating requested data
    if (type == 'admin') {
        const validation = validateObjectData(add_admin_schema, reqData);
        if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);
    }
    else {
        const validation = validateObjectData(add_subadmin_schema, reqData);
        if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);
    }

    if (reqData.city) {
        const count = await City.countDocuments({ _id: reqData.city, is_active: true, soft_delete: false });
        if (count == 0) throw new CustomError("City does not exist or is disabled", 406);
    }

    if (reqData.venue) {
        const count = await Venue.countDocuments({ _id: reqData.venue, is_active: true, soft_delete: false });
        if (count == 0) throw new CustomError("Venue does not exist or is disabled", 406);
    }

    if (reqData.city && reqData.venue) {
        const venue = await Venue.countDocuments({ _id: { $in: reqData.venue }, city: reqData.city });
        if (venue == 0 || (Array.isArray(reqData.venue) && venue < reqData.venue.length)) throw new CustomError("The venue is not in the city you selected", 406);
    }

    //matching duplicate email
    const matchExisting = await Admin.find({ email: reqData.email, soft_delete: false });
    if (matchExisting && matchExisting.length != 0) throw new CustomError('Email already registered', 409);

    //creating new user
    let newAdmin;
    if (type === 'admin') {
        newAdmin = await Admin.create({ email: reqData.email, city: reqData.city, is_admin: true, is_subadmin: false, is_superadmin: false });
    }
    else {
        newAdmin = await Admin.create({ email: reqData.email, city: reqData.city, venue: reqData.venue, is_subadmin: true, is_superadmin: false, is_admin: false });
    }

    //generating email token and creating verification entry
    const emailToken = await generateEmailToken();
    const verificationLink = await Verification.create({
        employeeId: newAdmin._id,
        type: 'USER_REGISTRATION',
        token: emailToken
    });

    //Sending mail to user
    sendMail(newAdmin.email, "Welcome to D3", "userRegistration", {
        link: generateFrontEndURL("registration", newAdmin.email, verificationLink.token, 'admin')
    });

    const response = response200(`${type == 'admin' ? 'Admin' : "Subadmin"} created successfully`, { id: newAdmin._id });
    return res.status(response[0]).json(response[1]);
}));

router.get('/get-authority-members', [verifyJWT, view(menus.Admins)], asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqQuery = req.query;
    const type = req.headers.type;
    const user = req.user;

    if (!type) throw new CustomError("Type is required", 406);
    if (type != 'admin' && type != 'partner') {
        throw new CustomError("Type can be ['admin', 'subadmin'] only", 406);
    }

    if (!user) throw new CustomError("Permission denied", 403);

    //Validating requested data
    const validation = validateObjectData(get_all_admins_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: AdminQuery = {
        soft_delete: false,
    }

    //Preparing where clause for the query
    var regExp = new RegExp("true");
    reqQuery.is_active && (where.is_active = regExp.test(String(reqQuery.is_active)));
    type == 'admin' && (where.is_admin = true);
    type == 'partner' && (where.partner = true);
    reqQuery.search && (where.$or = [
        { first_name: { $regex: String(reqQuery.search), $options: 'i' } },
        { last_name: { $regex: String(reqQuery.search), $options: 'i' } },
        { email: { $regex: String(reqQuery.search), $options: 'i' } },
        { mobile: { $regex: String(reqQuery.search), $options: 'i' } },
    ]);
    reqQuery.id && (where._id = new Types.ObjectId(String(reqQuery.id)));

    if (user && 'city' in user && user.city) {
        where.city = user.city._id;
    }

    const sortOptions: string | { [key: string]: SortOrder | { $meta: any; }; } | [string, SortOrder][] | null | undefined = [];
    if (reqQuery.orderBy) {
        sortOptions.push([String(reqQuery.orderBy), reqQuery.sort === 'asc' ? 1 : -1]);
    } else {
        sortOptions.push(["createdAt", 1]);
    }

    //Fetching data from database
    const admins = (await Admin.find(where)
        .skip(Number(reqQuery.offset))
        .limit(Number(reqQuery.limit))
        .sort(sortOptions)
        .populate({ path: 'city', select: 'name', options: { strictPopulate: false } })
        .populate({ path: 'venue', select: 'name', options: { strictPopulate: false } }))
        .map((emp) => {
            return {
                id: emp._id,
                first_name: emp.first_name,
                last_name: emp.last_name,
                email: emp.email,
                mobile: emp.mobile,
                is_admin: emp.is_admin,
                partner: emp.partner,
                is_active: emp.is_active,
                email_verified: emp.email_verified,
                gender: emp.gender,
                profile_image: emp.profile_image,
                venue: emp.venue,
                address: emp.address,
                city: emp.city
            }
        });

    if (type == 'admin') {
        admins.forEach(admin => {
            if ('is_subadmin' in admin) {
                delete (admin as any).is_subadmin
            }
        });
    } else {
        admins.forEach(admin => {
            if ('is_admin' in admin) {
                delete (admin as any).is_admin;
            }
        });
    }
    const count = await Admin.countDocuments(where);

    const response = response200("All admins fetched successfully", { count, admins });
    return res.status(response[0]).json(response[1]);
}));

router.post('/resend-mail-to-authority', [verifyJWT, add(menus.Admins)], asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    const validation = validateObjectData(add_employee_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const employee = await Admin.findOne({ email: reqData.email, soft_delete: false });
    if (!employee) throw new CustomError("Email not registered", 406);
    if (employee && employee.email_verified) throw new CustomError("Email already verified, please login", 406);

    await Verification.deleteMany({
        employeeId: employee._id,
        soft_delete: false
    });

    const emailToken = await generateEmailToken();
    const verificationLink = await Verification.create({
        employeeId: employee._id,
        type: 'USER_REGISTRATION',
        token: emailToken
    });
    sendMail(employee.email, "Welcome to D3", "userRegistration", {
        link: generateFrontEndURL("registration", employee.email, verificationLink.token, `${employee.is_admin ? 'admin' : 'subadmin'}`)
    });

    let response = response200("Email sent successfully", {});
    return res.status(response[0]).json(response[1]);
}));

router.post('/update-authority-member', [verifyJWT, update(menus.Admins)], asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqData = req.body;
    const type = req.headers.type;
    const user = req.user;

    if (!type) throw new CustomError("Type is required", 406);

    if (type == 'admin' && user && ((!('is_superadmin' in user) && !user.is_superadmin) || ('added_by' in user && user.added_by != 'SA'))) {
        throw new CustomError("Permission denied", 403);
    }

    const admin = await Admin.findOne({ _id: reqData.id });
    if (admin && !admin.email_verified) throw new CustomError("Member can not be update before email verification", 406);

    //Validating requested data
    if (type == 'admin') {
        const validation = validateObjectData(update_admin_schema, reqData);
        if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);
    }
    else {
        const validation = validateObjectData(update_subadmin_schema, reqData);
        if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);
    }

    if (reqData.city) {
        const count = await City.countDocuments({ _id: reqData.city, is_active: true, soft_delete: false });
        if (count == 0) throw new CustomError("City does not exist or is disabled", 406);
    }

    if (reqData.venue) {
        const admin = await Admin.findById({ _id: reqData.id });
        const where = {
            _id: reqData.venue,
            city: admin?.city,
            is_active: true,
            soft_delete: false
        }
        const count = await Venue.countDocuments(where);
        if (count == 0) throw new CustomError("Venue does not exist in the city you selected or is disabled", 406);
    }

    if (reqData.city && reqData.venue) {
        const venue = await Venue.countDocuments({ _id: { $in: reqData.venue }, city: reqData.city });
        if (venue == 0 || (Array.isArray(reqData.venue) && venue < reqData.venue.length)) throw new CustomError("The venue is not in the city you selected", 406);
    }

    const data = {
        first_name: reqData?.first_name,
        last_name: reqData?.last_name,
        mobile: reqData?.mobile,
        city: reqData?.city,
        venue: reqData?.venue,
        is_active: reqData?.is_active,
        salary: reqData?.salary,
    }

    await Admin.findByIdAndUpdate(
        { _id: reqData.id },
        { $set: data },
    )

    const response = response200(`${type == 'admin' ? 'Admin' : 'Subadmin'} updated successfully`, {});
    return res.status(response[0]).json(response[1]);
}));

router.post('/remove-authority-members', [verifyJWT, remove(menus.Admins)], asyncHandler(async (req: Request, res: Response) => {
    const reqIds = req.body.authorityIds;

    const validation = validateArrayData(remove_admin_schema, reqIds);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    await Admin.updateMany(
        { _id: { $in: reqIds } },
        { $set: { soft_delete: true } }
    );

    const response = response200("Members removed successfully", {});
    return res.status(response[0]).json(response[1]);
}));

export default router;