import bcrypt from 'bcrypt';
import config from 'config';
import jwt from 'jsonwebtoken';
import { CustomRequest } from "../server";
import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { Request, Response, Router } from "express";
import verifyJWT from "../middlewares/authentication";
import { login_schema } from "../validation/authValidation";
import { validateObjectData } from "../lib/helpers/validation";
import { Admin, BlacklistedToken, Employee, Menu, Role } from '../schemas/schema';
import { adminMenuArr, response200, partnerMenuArr, superadminMenuArr } from "../lib/helpers/utils";

const router = Router();

router.post('/emp-login', asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    //validating requested data
    const validation = validateObjectData(login_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where = {
        email: reqData.email,
        soft_delete: false,
    }

    //finding employee
    const employee = await Employee.findOne(where)
        .populate({ path: 'city', select: 'name', options: { strictPopulate: false } });

    if (!employee) throw new CustomError('Invalid credentials', 401);
    if (employee && !employee.email_verified) throw new CustomError("Email not verified", 401);
    if (employee && !employee.is_active) throw new CustomError("Permission denied, please contact admin", 403);

    // match password
    const validatePassword = employee.password && await bcrypt.compare(reqData.password, employee.password);
    if (!validatePassword) throw new CustomError('Invalid credentials', 401);

    //Payload for jwt token
    let payload = {
        id: employee._id,
        email: employee.email,
        mobile: employee.mobile,
        gender: employee.gender,
        address: employee.address,
        last_name: employee.last_name,
        first_name: employee.first_name,
        profile_image: employee.profile_image,
        city: 'city' in employee ? employee.city : null,
        venue: 'venue' in employee ? employee.venue : null,
        role: 'role' in employee ? employee.role : undefined,
        ground: 'ground' in employee ? employee.ground : null,
        added_by: 'added_by' in employee ? employee.added_by : undefined,
        menu: Array(),
    };

    let secretkey = config.get('jwt_secretkey');
    if (!secretkey) throw new CustomError("JWT Secret key not defined", 500);

    //Generate jwt
    const token = `Bearer ${jwt.sign(payload, String(config.get('jwt_secretkey')), { expiresIn: '30d' })}`;

    //finding role and permissions for that role
    if ('role' in employee && employee.role) {
        const role = await Role.findById({ _id: employee.role }).populate({
            path: 'permissions.menu',
            select: 'name'
        });

        role && role.permissions.map((permission: any) => {
            payload.menu.push({
                name: permission.menu.name,
                add: permission.add,
                view: permission.view,
                update: permission.update,
                delete: permission.delete
            });
        });
    }

    res.setHeader("authorization", token);
    res.setHeader("Access-Control-Expose-Headers", "*");
    let response = response200("Login successful", payload);
    return res.status(response[0]).json(response[1]);
}));

router.get('/verify-session', verifyJWT, asyncHandler(async (req: CustomRequest, res: Response) => {
    const user = req.user;

    if (!user) throw new CustomError("Session expired, please login again", 403);

    const employee = "added_by" in user
        ? await Employee.findOne({ _id: user.id, is_active: true, soft_delete: false })
            .populate({ path: 'city', select: 'name', options: { strictPopulate: false } })
        : await Admin.findOne({ _id: user.id, is_active: true, soft_delete: false })
            .populate({ path: 'city', select: 'name', options: { strictPopulate: false } });

    if (!employee) throw new CustomError("Session expired", 403);

    let payload = {
        id: employee._id,
        email: employee.email,
        mobile: employee.mobile,
        gender: employee.gender,
        address: employee.address,
        last_name: employee.last_name,
        first_name: employee.first_name,
        profile_image: employee.profile_image,
        city: 'city' in employee ? employee.city : null,
        is_admin: 'is_admin' in employee ? employee.is_admin : undefined,
        partner: 'partner' in employee ? employee.partner : undefined,
        is_superadmin: 'is_superadmin' in employee ? employee.is_superadmin : undefined,
        venue: 'venue' in employee ? employee.venue : null,
        role: 'role' in employee ? employee.role : undefined,
        ground: 'ground' in employee ? employee.ground : null,
        added_by: 'added_by' in employee ? employee.added_by : undefined,
        menu: Array(),
    };

    const allMenus = (await Menu.find({ soft_delete: false })).map(menu => menu.name);
    if ('is_superadmin' in employee && employee.is_superadmin) {
        payload.is_superadmin = true;
        delete payload.added_by;
        let superadminMenu = allMenus.filter(menu => superadminMenuArr.includes(menu));
        superadminMenu.forEach(menu => {
            payload.menu.push({
                name: menu,
                add: true,
                view: true,
                update: true,
                delete: true
            });
        });
    }
    else if ('is_admin' in employee && employee.is_admin) {
        payload.is_admin = true;
        delete payload.added_by;
        let adminMenu = allMenus.filter(menu => adminMenuArr.includes(menu));
        adminMenu.forEach(menu => {
            payload.menu.push({
                name: menu,
                add: true,
                view: true,
                update: true,
                delete: true
            });
        });
    }
    else if ('partner' in employee && employee.partner) {
        payload.partner = true;
        delete payload.added_by;
        const partnerMenu = allMenus.filter(menu => partnerMenuArr.includes(menu));
        partnerMenu.forEach(menu => {
            payload.menu.push({
                name: menu,
                add: true,
                view: true,
                update: true,
                delete: true
            })
        });
    }

    else if ('role' in employee && employee.role) {
        delete payload.is_superadmin;
        delete payload.is_admin;
        delete payload.partner;
        const role = await Role.findById({ _id: employee.role }).populate({
            path: 'permissions.menu',
            select: 'name'
        });

        role && role.permissions.map((permission: any) => {
            payload.menu.push({
                name: permission.menu.name,
                add: permission.add,
                view: permission.view,
                update: permission.update,
                delete: permission.delete
            });
        });
    }
    else {
        delete payload.is_superadmin;
        delete payload.is_admin;
        delete payload.partner;
    }

    const response = response200("Session verified ", payload);
    return res.status(response[0]).json(response[1]);
}));

router.post('/authority-login', asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    //validating requested data
    const validation = validateObjectData(login_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where = {
        email: reqData.email,
        soft_delete: false
    }

    //finding admin
    const admin = await Admin.findOne(where)
        .populate({ path: 'city', select: 'name', options: { strictPopulate: false } });

    if (!admin) throw new CustomError("Invalid credentials", 401);
    if (admin && !admin.email_verified) throw new CustomError("Email not verified", 401)
    if (admin && !admin.is_active) throw new CustomError("Permission denied, please contact admin", 403);

    //match password
    const validatePassword = admin.password && await bcrypt.compare(reqData.password, admin.password)
    if (!validatePassword) throw new CustomError('Invalid credentials', 401);

    //payload for jwt token
    const payload = {
        id: admin._id,
        email: admin.email,
        mobile: admin.mobile,
        gender: admin.gender,
        address: admin.address,
        last_name: admin.last_name,
        first_name: admin.first_name,
        profile_image: admin.profile_image,
        city: 'city' in admin && admin.city,
        venue: 'venue' in admin ? admin.venue : null,
        is_admin: 'is_admin' in admin ? admin.is_admin : undefined,
        partner: 'partner' in admin ? admin.partner : undefined,
        is_superadmin: 'is_superadmin' in admin ? admin.is_superadmin : undefined,
        menu: Array(),
    }

    let secretkey = config.get('jwt_secretkey');
    if (!secretkey) throw new CustomError("JWT Secret key not defined", 500);

    //Generate jwt
    const token = `Bearer ${jwt.sign(payload, String(config.get('jwt_secretkey')), { expiresIn: '30d' })}`;

    //Dashboard menu list for superadmin/admin/subadmin
    const allMenus = (await Menu.find({ soft_delete: false })).map(menu => menu.name);
    if ('is_superadmin' in admin && admin.is_superadmin) {
        let superadminMenu = allMenus.filter(menu => superadminMenuArr.includes(menu));
        superadminMenu.forEach(menu => {
            payload.menu.push({
                name: menu,
                add: true,
                view: true,
                update: true,
                delete: true
            });
        });
    }
    else if ('is_admin' in admin && admin.is_admin) {
        let adminMenu = allMenus.filter(menu => adminMenuArr.includes(menu));
        adminMenu.forEach(menu => {
            payload.menu.push({
                name: menu,
                add: true,
                view: true,
                update: true,
                delete: true
            });
        });
    }
    else if ('partner' in admin && admin.partner) {
        const partnerMenu = allMenus.filter(menu => partnerMenuArr.includes(menu));
        partnerMenu.forEach(menu => {
            payload.menu.push({
                name: menu,
                add: true,
                view: true,
                update: true,
                delete: true
            })
        });
    }

    res.setHeader("authorization", token);
    res.setHeader("Access-Control-Expose-Headers", "*");
    let response = response200("Login successful", payload);
    return res.status(response[0]).json(response[1]);

}));

router.get('/logout', verifyJWT, asyncHandler(async (req: CustomRequest, res: Response) => {
    const auth = req.headers.authorization;

    if (!auth) throw new CustomError("Token does not exists", 406);

    const token = auth.split(" ")[1];

    await BlacklistedToken.create({ token });

    const response = response200("Logout successful", {});
    return res.status(response[0]).json(response[1]);
}));

export default router;