import { IRole } from "../types/types";
import { CustomRequest } from "../server";
import { FilterQuery, Types } from "mongoose";
import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { response200 } from "../lib/helpers/utils";
import { Request, Response, Router } from "express";
import { City, Role, Venue } from "../schemas/schema";
import verifyJWT from "../middlewares/authentication";
import { add, menus, remove, update, view } from "../middlewares/permission";
import { validateArrayData, validateObjectData } from "../lib/helpers/validation";
import { add_role_schema, get_role_schema, remove_role_schema, update_role_schema } from "../validation/roleValidation";

interface RoleQuery extends FilterQuery<IRole> {
    $or?: Array<{ [key: string]: any }>;
    city?: Types.ObjectId;
    _id?: Types.ObjectId;
    venue?: {
        $in: Array<Types.ObjectId>;
    }
}

const router = Router();

router.post('/add-role', [verifyJWT, add(menus.Roles)], asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqData = req.body;
    const user = req.user;

    if (!user) throw new CustomError("Permission denied", 403);


    if ((('is_admin' in user && user.is_admin) || ('added_by' in user && user.added_by == 'AD')) && !reqData.city) {
        throw new CustomError("City is required", 406);
    }

    if ((('is_subadmin' in user && user.is_subadmin) || ('added_by' in user && user.added_by == 'SUB')) && !reqData.venue) {
        throw new CustomError("Venue is required", 406);
    }

    if (reqData.city) {
        const count = await City.countDocuments({ _id: reqData.city, is_active: true, soft_delete: false });
        if (count == 0) throw new CustomError("City does not exist or is disabled", 406)
    }

    if (reqData.venue) {
        const count = await Venue.countDocuments({ _id: reqData.venue, is_active: true, soft_delete: false });
        if (count == 0) throw new CustomError("City does not exist or is disabled", 406)
    }

    if (reqData.venue && !reqData.city) throw new CustomError("City is required", 406);

    const validation = validateObjectData(add_role_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where = {
        name: reqData.name.toUpperCase(),
        city: reqData?.city,
        venue: reqData?.venue,
        soft_delete: false
    }

    const role = await Role.find(where);
    if (role.length != 0) throw new CustomError("Role already exists", 409);

    const data = {
        city: reqData?.city,
        venue: reqData?.venue,
        name: reqData.name.toUpperCase(),
        permissions: reqData.permissions,
        added_by: ""
    }

    if (user && (('is_superadmin' in user && user.is_superadmin) || ('added_by' in user && user.added_by == 'SA'))) {
        data.added_by = 'SA'
    }
    else if (user && (('is_admin' in user && user.is_admin) || ('added_by' in user && user.added_by == 'AD'))) {
        data.added_by = 'AD'
    }
    else if (user && (('is_subadmin' in user && user.is_subadmin) || ('added_by' in user && user.added_by == 'SUB'))) {
        data.added_by = 'SUB'
    }

    const newRole = await Role.create(data);

    const response = response200("Role created successfully", { id: newRole.id });
    return res.status(response[0]).json(response[1]);
}));

router.get('/get-all-roles', [verifyJWT, view(menus.Roles)], asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqQuery = req.query;
    const user = req.user;

    if (!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(get_role_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    let where: RoleQuery = {
        soft_delete: false,
    };

    if ('is_admin' in user && user.is_admin) {
        where.city = new Types.ObjectId(String(user.city._id));
    }
    else if ('added_by' in user && user.added_by == 'AD') {
        where.city = new Types.ObjectId(String(user.city._id));
    }
    else if ('is_subadmin' in user && user.is_subadmin) {
        where.city = new Types.ObjectId(String(user.city._id));
        const venueIds = user.venue.map((id: any) => {
            return new Types.ObjectId(String(id));
        });
        where.venue = { $in: venueIds };
    }
    else if ('added_by' in user && user.added_by == 'SUB') {
        where.city = new Types.ObjectId(String(user.city._id));
        const venueIds = user.venue.map((id: any) => {
            return new Types.ObjectId(String(id));
        });
        where.venue = { $in: venueIds };
    }
    else {
        where.city = undefined;
    }

    if (reqQuery.search) {
        where.$or = [{ name: { $regex: String(reqQuery.search), $options: 'i' } }];
    }

    if ((('is_superadmin' in user && user.is_superadmin) || ('added_by' in user && user.added_by == 'SA'))) {
        where.added_by = 'SA'
    }
    else if ((('is_admin' in user && user.is_admin) || ('added_by' in user && user.added_by == 'AD'))) {
        where.added_by = 'AD'
    }
    else if ((('is_subadmin' in user && user.is_subadmin) || ('added_by' in user && user.added_by == 'SUB'))) {
        where.added_by = 'SUB'
    }

    var regExp = new RegExp("true");
    reqQuery.is_active && (where.is_active = regExp.test(String(reqQuery.is_active)));
    reqQuery.id && (where._id = new Types.ObjectId(String(reqQuery.id)));

    const roles = (await Role.find(where)
        .skip(Number(reqQuery.offset))
        .limit(Number(reqQuery.limit))
        .populate({ path: 'city', select: 'name', options: { strictPopulate: false } })
        .populate({ path: 'venue', select: 'name', options: { strictPopulate: false } }))
        .map((role) => {
            return {
                id: role._id,
                name: role.name,
                city: role.city,
                venue: role?.venue,
                permissions: role.permissions,
                is_active: role.is_active
            }
        });

    const count = await Role.countDocuments(where);

    const response = response200("Roles fetched successfully", { count, roles });
    res.status(response[0]).json(response[1]);
}));

router.post('/update-role', [verifyJWT, update(menus.Roles)], asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqData = req.body;
    const user = req.user;

    if (!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(update_role_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if ((('is_admin' in user && user.is_admin) || ('added_by' in user && user.added_by == 'AD')) && !reqData.city) {
        throw new CustomError("City is required", 406);
    }

    if ((('is_subadmin' in user && user.is_subadmin) || ('added_by' in user && user.added_by == 'SUB')) && !reqData.venue) {
        throw new CustomError("Venue is required", 406);
    }

    const data = {
        name: reqData.name.toUpperCase(),
        city: reqData?.city,
        venue: reqData?.venue,
        permissions: reqData?.permissions,
        is_active: reqData?.is_active
    }

    if ((('is_admin' in user && user.is_admin) || ('added_by' in user && user.added_by == 'AD'))) {
        data.city = reqData?.city
    }
    else {
        delete data.city;
    }

    if ((('is_subadmin' in user && user.is_subadmin) || ('added_by' in user && user.added_by == 'SUB'))) {
        data.city = reqData?.venue
    }
    else {
        delete data.venue
    }

    await Role.findByIdAndUpdate(
        { _id: reqData.id },
        { $set: data }
    );

    const response = response200("Role updated successfully", {});
    return res.status(response[0]).json(response[1]);
}));

router.post('/remove-roles', [verifyJWT, remove(menus.Roles)], asyncHandler(async (req: Request, res: Response) => {
    const reqIds = req.body.roleIds;

    const validation = validateArrayData(remove_role_schema, reqIds);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    await Role.updateMany(
        { _id: { $in: reqIds } },
        { $set: { soft_delete: true } }
    );

    const response = response200('Role removed successfully', {});
    return res.status(response[0]).json(response[1]);
}));

router.get('/fetch-roles', verifyJWT, asyncHandler(async (req: CustomRequest, res: Response) => {
    let reqQuery = req.query;
    reqQuery = { ...reqQuery, venue: reqQuery.venue && JSON.parse(String(reqQuery.venue)) };
    const user = req.user;

    if (!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(get_role_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    let where: RoleQuery = {
        soft_delete: false,
        is_active: true
    };

    if (user && (('is_subadmin' in user && user.is_subadmin) || ('added_by' in user && user.added_by == 'SUB')) && !reqQuery.venue) {
        throw new CustomError("Venue is required", 406);
    }

    if (reqQuery.search) {
        where.$or = [{ name: { $regex: String(reqQuery.search), $options: 'i' } }];
    }

    if (user && (('is_superadmin' in user && user.is_superadmin) || ('added_by' in user && user.added_by == 'SA'))) {
        where.added_by = 'SA'
    }
    else if (user && (('is_admin' in user && user.is_admin) || ('added_by' in user && user.added_by == 'AD'))) {
        where.added_by = 'AD'
    }
    else {
        where.added_by = 'SUB'
    }

    if ('city' in user && user.city) {
        where.city = new Types.ObjectId(String(user.city._id));
    }
    reqQuery.id && (where._id = new Types.ObjectId(String(reqQuery.id)));
    if (reqQuery.venue && Array.isArray(reqQuery.venue) && reqQuery.venue.length != 0) {
        const venueIds = reqQuery.venue.map((id) => {
            return new Types.ObjectId(String(id));
        });
        where.venue = { $in: venueIds }
    }

    const roles = (await Role.find(where)
        .skip(Number(reqQuery.offset))
        .limit(Number(reqQuery.limit)))
        .map((role) => {
            return {
                id: role._id,
                name: role.name
            }
        });

    const response = response200("Roles fetched successfully", { roles });
    res.status(response[0]).json(response[1]);
}));

export default router;