import bcrypt from 'bcrypt';
import { CustomRequest } from "../server";
import { FilterQuery, Types } from "mongoose";
import { sendMail } from "../lib/helpers/mail";
import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { Request, Response, Router } from "express";
import verifyJWT from "../middlewares/authentication";
import { Admin, Employee, Verification } from '../schemas/schema';
import { generateEmailToken } from "../lib/helpers/authentication";
import { AddedBy, IEmployee, VerificationType } from "../types/types";
import { generateFrontEndURL, response200 } from "../lib/helpers/utils";
import { add, menus, remove, update, view } from "../middlewares/permission";
import { validateArrayData, validateObjectData } from "../lib/helpers/validation";
import { add_employee_schema, emp_registration_schema, employee_schema, get_all_employees_schema, remove_employee_schema, update_employee_schema } from "../validation/empValidation";

const router = Router();

interface EmployeeQuery extends FilterQuery<IEmployee> {
    $or?: Array<{ [key: string]: any }>;
    is_active?: {
        $in: Array<Boolean>;
    };
    is_subadmin?: boolean;
    added_by?: {
        $in: Array<AddedBy>;
    };
    _id?: Types.ObjectId;
    city?: Types.ObjectId;
}

router.post('/add-emp', [verifyJWT, add(menus.Employees)], asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqData = req.body;
    const user = req.user;

    if (!user) throw new CustomError("Permission denied", 403);
    //Validating requested data
    const validation = validateObjectData(add_employee_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if ((('partner' in user && user.partner) || ('added_by' in user && user.added_by == 'PN')) && reqData.venue && Array.isArray(reqData.venue) && reqData.venue.length == 0) throw new CustomError("Venue is required", 406);

    const findExisting = await Employee.findOne({ email: reqData.email, soft_delete: false });
    if (findExisting && findExisting.email_verified) throw new CustomError("Email already registered", 409);
    if (findExisting && !findExisting.email_verified) throw new CustomError("Email already registered, please resend mail", 409);

    const data = {
        email: reqData.email,
        added_by: '',
        city: null,
        venue: null
    }

    if (user && (('is_superadmin' in user && user.is_superadmin) || ('added_by' in user && user.added_by == 'SA'))) {
        data.added_by = 'SA';
    }
    else if (user && (('is_admin' in user && user.is_admin) || ('added_by' in user && user.added_by == 'AD'))) {
        data.added_by = 'AD';
        data.city = user.city._id;
    }
    else if (user && (('partner' in user && user.partner) || ('added_by' in user && user.added_by == 'PN'))) {
        let checkVenuePerm = reqData.venue.every((id: any) => user.venue.includes(id));
        if (!checkVenuePerm) throw new CustomError("Permission denied", 403);
        data.added_by = 'PN';
        data.venue = reqData.venue
        data.city = user.city._id;
    }

    const employee = await Employee.create(data);
    const emailToken = await generateEmailToken();
    const verificationLink = await Verification.create({
        employeeId: employee._id,
        type: 'USER_REGISTRATION',
        token: emailToken
    });
    sendMail(employee.email, "Welcome to D3", "userRegistration", {
        link: generateFrontEndURL("registration", employee.email, verificationLink.token, 'regular')
    });

    let response = response200("Employees added successfully", { id: employee._id });
    return res.status(response[0]).json(response[1]);
}));

router.post('/emp-registration', asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    //Validating requested data
    const validation = validateObjectData(emp_registration_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    //Checking verification link expiration
    const verificationLink = await Verification.find({
        token: reqData.token,
        soft_delete: false
    });

    if (verificationLink.length == 0) throw new CustomError("Invalid or expired verification link.", 401);

    //Verifying mobile number and email id
    const emp = reqData.empType == 'regular' ? await Employee.find({ mobile: reqData.mobile }) : await Admin.find({ mobile: reqData.mobile });
    if (emp.length != 0) throw new CustomError("Mobile number already exists", 406);

    const employee = reqData.empType == 'regular' ? await Employee.find({ email: reqData.email }) : await Admin.find({ email: reqData.email });
    if (employee.length == 0) throw new CustomError("Permission denied", 403);

    if (verificationLink[0].employeeId != employee[0].id || verificationLink[0].type != VerificationType.USER_REGISTRATION) {
        throw new CustomError("Email and token mismatch", 409)
    }

    await Verification.deleteOne(
        { _id: verificationLink[0].id },
    );

    const male_profile = 'assets/male.png';
    const female_profile = 'assets/female.jpg';

    //Preparing data for update the user
    const hashedPassword = await bcrypt.hash(reqData.password, 10);
    const data = {
        first_name: reqData.first_name,
        last_name: reqData.last_name,
        mobile: reqData.mobile,
        password: hashedPassword,
        email_verified: true,
        gender: reqData.gender,
        profile_image: reqData.gender == 'Male' ? male_profile : female_profile
    };

    reqData.empType == 'regular' ? await Employee.updateOne(
        { _id: employee[0].id },
        { $set: data }
    )
        : await Admin.updateOne(
            { _id: employee[0].id },
            { $set: data }
        );

    const response = response200(`${reqData.empType == 'regular' ? 'Employee' : 'Admin'} registered successfully`, {});
    return res.status(response[0]).json(response[1]);
}));

router.get('/get-all-employees', [verifyJWT, view(menus.Employees)], asyncHandler(async (req: CustomRequest, res: Response) => {
    let reqQuery = req.query;
    reqQuery = {
        ...reqQuery,
        is_active: req.query.is_active && JSON.parse(String(reqQuery.is_active))
    }
    const user = req.user;
    
    if (!user) throw new CustomError("Permission denied", 403);

    //Validating requested data
    const validation = validateObjectData(get_all_employees_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: EmployeeQuery = {
        soft_delete: false,
        added_by: {
            $in: [AddedBy.SA]
        }
    }
    //Preparing where clause for query
    var regExp = new RegExp("true");
    if (reqQuery.is_active && Array.isArray(reqQuery.is_active) && reqQuery.is_active.length != 0) {
        const active_status = reqQuery.is_active.map((status) => {
            return regExp.test(String(status));
        });
        where.is_active = { $in: active_status }
    }
    reqQuery.is_subadmin && (where.is_subadmin = regExp.test(String(reqQuery.is_subadmin)));
    reqQuery.search && (where.$or = [
        { first_name: { $regex: String(reqQuery.search), $options: 'i' } },
        { last_name: { $regex: String(reqQuery.search), $options: 'i' } },
        { email: { $regex: String(reqQuery.search), $options: 'i' } },
        { mobile: { $regex: String(reqQuery.search), $options: 'i' } },
    ]);
    reqQuery.id && (where._id = new Types.ObjectId(String(reqQuery.id)));
    if (user && 'city' in user && user.city) {
        where.city = new Types.ObjectId(String(user.city._id));
    }

    if (('is_superadmin' in user && user.is_superadmin) || ('added_by' in user && user.added_by == 'SA')) {
        where.added_by = {
            $in: [AddedBy.SA]
        };
    }
    else if (('is_admin' in user && user.is_admin) || ('added_by' in user && user.added_by == 'AD')) {
        where.added_by = {
            $in: [AddedBy.AD]
        }
    }
    else {
        where.added_by = {
            $in: [AddedBy.PN]
        }
    }

    //Fetching data from database
    const employees = (await Employee.find(where)
        .skip(Number(reqQuery.offset))
        .limit(Number(reqQuery.limit))
        .populate({ path: 'city', select: 'name', options: { strictPopulate: false } })
        .populate({ path: 'role', select: 'name', options: { strictPopulate: false } })
        .populate({ path: 'ground', select: 'name', options: { strictPopulate: false }, populate: { path: 'venue', select: 'name', options: { strictPopulate: false } } }))
        .map((emp) => {            
            return {
                id: emp._id,
                first_name: emp.first_name,
                last_name: emp.last_name,
                email: emp.email,
                mobile: emp.mobile,
                is_active: emp.is_active,
                email_verified: emp.email_verified,
                gender: emp.gender,
                profile_image: emp.profile_image,
                address: emp.address,
                added_by: emp.added_by,
                city: emp?.city,
                role: emp?.role,
                ground: emp.ground,
                salary: emp.salary
            }
        });

    const count = await Employee.countDocuments(where);

    const response = response200("All employees fetched successfully", { count, employees });
    req.io?.emit('apiCalled', { message: "API called" });
    return res.status(response[0]).json(response[1]);
}));

router.post('/update-emp', [verifyJWT, update(menus.Employees)], asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    const validation = validateObjectData(update_employee_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const employee = await Employee.findById({ _id: reqData.id, soft_delete: false });
    if (!employee) throw new CustomError("Employee not found.", 404);

    if (!employee.email_verified) throw new CustomError("Employee's email is not verified", 406);

    // if (reqData.ground && (employee.venue?.length == 0 || reqData.venue)) throw new CustomError("Venue is required for assigning ground", 406);

    const data = {
        first_name: reqData?.first_name,
        last_name: reqData?.last_name,
        mobile: reqData?.mobile,
        gender: reqData?.gender,        
        is_active: reqData?.is_active,
        venue: reqData?.venue,
        ground: reqData?.ground,
        role: reqData?.role,
        salary: reqData?.salary
    }

    await Employee.findByIdAndUpdate(
        { _id: reqData.id },
        { $set: data }
    );

    const response = response200("Employee updated successfully", {});
    return res.status(response[0]).json(response[1]);
}));

router.post('/remove-employee', [verifyJWT, remove(menus.Employees)], asyncHandler(async (req: Request, res: Response) => {
    const reqIds = req.body.empIds;

    const validation = validateArrayData(remove_employee_schema, reqIds);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    await Employee.updateMany(
        { _id: { $in: reqIds } },
        { $set: { soft_delete: true } }
    );

    const response = response200("Employee removed successfully", {});
    return res.status(response[0]).json(response[1]);
}));

router.post('/resend-mail', [verifyJWT, add(menus.Employees)], asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    const validation = validateObjectData(add_employee_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const employee = await Employee.findOne({ email: reqData.email, soft_delete: false });
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
        link: generateFrontEndURL("registration", employee.email, verificationLink.token, 'regular')
    });

    let response = response200("Email sent successfully", {});
    return res.status(response[0]).json(response[1]);
}));

router.get('/employee', asyncHandler(async (req: Request, res: Response)=>{
    const reqQuery = req.query;

    const validation = validateObjectData(employee_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const user = await Employee.findById(reqQuery.id);

    const data = {
        id: user?._id,
        first_name: user?.first_name,
        last_name: user?.last_name,
        mobile: user?.mobile,
        profile_img: user?.profile_image,
    }

    const response = response200("", data);
    return res.status(response[0]).json(response[1]);
}));

export default router;