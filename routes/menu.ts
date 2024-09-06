import { Types } from "mongoose";
import { IMenu } from "../types/types";
import { Menu } from "../schemas/schema";
import { CustomRequest } from "../server";
import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { FilterQuery, SortOrder } from "mongoose";
import { Request, Response, Router } from "express";
import verifyJWT from "../middlewares/authentication";
import { add, menus, remove, update, view } from "../middlewares/permission";
import { adminMenuArr, response200, partnerMenuArr, superadminMenuArr } from "../lib/helpers/utils";
import { validateArrayData, validateObjectData, validateStringData } from "../lib/helpers/validation";
import { add_menu_schema, get_menu_schema, remove_menu_schema, update_menu_schema } from "../validation/menuValidation";

interface MenuQuery extends FilterQuery<IMenu> {
    $or?: Array<{ [key: string]: any }>;
    is_active?: boolean;
    _id?: Types.ObjectId;
}

const router = Router();

router.post('/add-menu', [verifyJWT, add(menus.Menus)], asyncHandler(async (req: Request, res: Response) => {
    const menuName = req.body.name;

    const validation = validateStringData(add_menu_schema, menuName);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const existingMenu = await Menu.find({ name: menuName.toUpperCase(), soft_delete: false });
    if (existingMenu.length !== 0) throw new CustomError("Menu name already exists", 406);

    const newMenu = new Menu({
        name: menuName.toUpperCase()
    });
    newMenu.save();

    const response = response200("Menu added successfully", { id: newMenu._id });
    return res.status(response[0]).json(response[1]);
}));

router.get('/get-menus', [verifyJWT, view(menus.Menus)], asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqQuery = req.query;
    const user = req.user;

    const validation = validateObjectData(get_menu_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    let where: MenuQuery = {
        soft_delete: false
    };

    if (reqQuery.search) {
        where.$or = [{ name: { $regex: String(reqQuery.search), $options: 'i' } }];
    }

    const sortOptions: string | { [key: string]: SortOrder | { $meta: any; }; } | [string, SortOrder][] | null | undefined = [];
    var regExp = new RegExp("true");
    reqQuery.is_active && (where.is_active = regExp.test(String(reqQuery.is_active)));
    reqQuery.id && (where._id = new Types.ObjectId(String(reqQuery.id)));

    if (reqQuery.orderBy) {
        sortOptions.push([String(reqQuery.orderBy), reqQuery.sort === 'asc' ? 1 : -1]);
    } else {
        sortOptions.push(["createdAt", 1]);
    }
    let menus = (await Menu.find(where)
        .sort(sortOptions)
        .skip(Number(reqQuery.offset))
        .limit(Number(reqQuery.limit))).map((menu) => {
            return {
                id: menu._id,
                name: menu.name,
                is_active: menu.is_active
            }
        });

    let count = await Menu.countDocuments(where);
    if (user && (('is_superadmin' in user && user.is_superadmin) || ('added_by' in user && user.added_by == 'SA'))) {
        menus = menus.filter(menu => superadminMenuArr.includes(menu.name));
        count = menus.length;
    }
    else if (user && (('is_admin' in user && user.is_admin) || ('added_by' in user && user.added_by == 'AD'))) {
        menus = menus.filter(menu => adminMenuArr.includes(menu.name));
        count = menus.length;
    }
    else if (user && 'is_subadmin' in user && user.is_subadmin) {
        menus = menus.filter(menu => partnerMenuArr.includes(menu.name));
        count = menus.length;
    }

    const response = response200("All menus fetched successfully", { count, menus });
    return res.status(response[0]).json(response[1]);
}));

router.post('/update-menu', [verifyJWT, update(menus.Menus)], asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    const validation = validateObjectData(update_menu_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if (reqData.name) {
        const menu = await Menu.find({ name: reqData.name.toUpperCase() });
        if (menu.length != 0) throw new CustomError("Menu name already exists", 406);
    }

    const data = {
        name: reqData.name && reqData.name.toUpperCase(),
        is_active: reqData?.is_active
    }

    await Menu.updateOne(
        { _id: reqData.id },
        { $set: data }
    );

    const response = response200("Menu updated successfully", {});
    return res.status(response[0]).json(response[1]);
}));

router.post('/remove-menus', [verifyJWT, remove(menus.Menus)], asyncHandler(async (req: Request, res: Response) => {
    const reqIds = req.body.menuIds;

    const validation = validateArrayData(remove_menu_schema, reqIds);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    await Menu.updateMany(
        { _id: { $in: reqIds } },
        { $set: { soft_delete: true } }
    );

    const response = response200("Menu removed successfully", {});
    return res.status(response[0]).json(response[1]);
}));

router.get('/fetch-menus', verifyJWT, asyncHandler(async (req: CustomRequest, res: Response) => {
    const user = req.user;

    const where = {
        soft_delete: false,
        is_active: true
    }

    let menus = (await Menu.find(where)).map((menu) => {
        return {
            id: menu._id,
            name: menu.name,
        }
    });

    if (user && (('is_superadmin' in user && user.is_superadmin) || ('added_by' in user && user.added_by == 'SA'))) {
        menus = menus.filter(menu => superadminMenuArr.includes(menu.name));
    }
    else if (user && (('is_admin' in user && user.is_admin) || ('added_by' in user && user.added_by == 'AD'))) {
        menus = menus.filter(menu => adminMenuArr.includes(menu.name));
    }
    else if (user && 'partner' in user && user.partner) {
        menus = menus.filter(menu => partnerMenuArr.includes(menu.name));
    }

    const response = response200("", menus);
    return res.status(response[0]).json(response[1]);
}));

export default router;