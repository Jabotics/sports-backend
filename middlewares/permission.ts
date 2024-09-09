import { Role } from "../schemas/schema";
import { CustomRequest } from "../server";
import { Response, NextFunction } from "express";
import { response403 } from "../lib/helpers/utils";

const menus = {
    Faq: 'FAQ',
    Blog: 'BLOG',
    Menus: 'MENUS',
    Roles: 'ROLES',
    Cities: 'CITIES',
    Admins: 'ADMINS',
    Venues: 'VENUES',
    EVENTS: 'EVENTS',
    Sports: 'SPORTS',
    Grounds: 'GROUNDS',
    Support: 'SUPPORT',
    Members: 'MEMBERS',
    Students: 'STUDENTS',
    Feedback: 'FEEDBACK',
    PAYMENTS: 'PAYMENTS',
    HOMEPAGE: 'HOMEPAGE',
    Expenses: 'EXPENSES',
    Inquiries: 'INQUIRIES',
    Employees: 'EMPLOYEES',
    Customers: 'CUSTOMERS',
    Academies: 'ACADEMIES',
    Slot_Times: 'SLOT_TIMES',
    SUB_ADMINS: 'SUB_ADMINS',
    Memberships: 'MEMBERSHIPS',
    Promo_Codes: 'PROMO_CODES',
    Reservation: 'RESERVATION',
    EVENT_REQUEST: 'EVENT_REQUEST',
    Slot_Bookings: 'SLOT_BOOKINGS',
    Happy_Customers: 'HAPPY_CUSTOMERS',
    Partner_Request: 'PARTNER_REQUEST',
    Ground_Review: 'GROUND_REVIEW'
}

const add = (menu_name: string) => {
    return async function (req: CustomRequest, res: Response, next: NextFunction) {
        const user = req.user;
        const type = req.headers.type;

        if (!user) {
            const response = response403("User not authenticated");
            return res.status(response[0]).json(response[1]);
        }
        else {
            try {
                if (type && type == 'subadmin' && !user.is_admin) {
                    menu_name = menus.SUB_ADMINS
                }
                const roles = await Role.findOne({ _id: user.role }).populate({
                    path: 'permissions.menu',
                    select: 'name'
                });
                let permission = roles?.permissions.find((permission: any) => permission.menu.name == menu_name);

                const response = response403("Permission denied");
                if (user && (user.is_superadmin || user.is_admin)) {
                    next();
                    return;
                }
                else if (user
                    && user.partner && (menu_name == menus.Grounds
                        || menu_name == menus.Employees
                        || menu_name == menus.Roles
                        || menu_name == menus.Slot_Times
                        || menu_name == menus.Slot_Bookings
                        || menu_name == menus.Expenses
                        || menu_name == menus.Reservation
                    )
                ) {
                    next();
                    return;
                }
                else if (!permission) {
                    return res.status(response[0]).json(response[1]);
                }
                else if (!permission.add) {
                    return res.status(response[0]).json(response[1]);
                }
                next();
            }
            catch (err) {
                console.log(err);
            }
        }
    }
}

const view = (menu_name: string) => {
    return async function (req: CustomRequest, res: Response, next: NextFunction) {
        const user = req.user;
        const type = req.headers.type;

        if (!user) {
            const response = response403("User not authenticated");
            return res.status(response[0]).json(response[1]);
        }
        else {
            try {
                if (type && type == 'subadmin' && !user.is_admin) {
                    menu_name = menus.SUB_ADMINS
                }
                const roles = await Role.findOne({ _id: user.role }).populate({
                    path: 'permissions.menu',
                    select: 'name'
                });
                let permission = roles?.permissions.find((permission: any) => permission.menu.name == menu_name);

                const response = response403("Permission denied");
                if (user && (user.is_superadmin || user.is_admin)) {
                    next();
                    return;
                }
                else if (user
                    && user.partner && (menu_name == menus.Grounds
                        || menu_name == menus.Employees
                        || menu_name == menus.Roles
                        || menu_name == menus.Slot_Times
                        || menu_name == menus.Slot_Bookings
                        || menu_name == menus.Expenses
                        || menu_name == menus.Reservation
                    )) {
                    next();
                    return;
                }
                else if (!permission) {
                    return res.status(response[0]).json(response[1]);
                }
                else if (!permission.view) {
                    return res.status(response[0]).json(response[1]);
                }

                next();
            }
            catch (err) {
                console.log(err);
            }
        }
    }
}

const update = (menu_name: string) => {
    return async function (req: CustomRequest, res: Response, next: NextFunction) {
        const user = req.user;
        const type = req.headers.type;

        if (!user) {
            const response = response403("User not authenticated");
            return res.status(response[0]).json(response[1]);
        }
        else {
            try {
                if (type && type == 'subadmin' && !user.is_admin) {
                    menu_name = menus.SUB_ADMINS
                }
                const roles = await Role.findOne({ _id: user.role }).populate({
                    path: 'permissions.menu',
                    select: 'name'
                });
                let permission = roles?.permissions.find((permission: any) => permission.menu.name == menu_name);

                const response = response403("Permission denied");
                if (user && (user.is_superadmin || user.is_admin)) {
                    next();
                    return;
                }
                else if (user
                    && user.partner && (menu_name == menus.Grounds
                        || menu_name == menus.Employees
                        || menu_name == menus.Roles
                        || menu_name == menus.Slot_Times
                        || menu_name == menus.Slot_Bookings
                        || menu_name == menus.Expenses
                        || menu_name == menus.Reservation
                    )) {
                    next();
                    return;
                }
                else if (!permission) {
                    return res.status(response[0]).json(response[1]);
                }
                else if (!permission.update) {
                    return res.status(response[0]).json(response[1]);
                }

                next();
            }
            catch (err) {
                console.log(err);
            }
        }
    }
}

const remove = (menu_name: string) => {
    return async function (req: CustomRequest, res: Response, next: NextFunction) {
        const user = req.user;
        const type = req.headers.type;

        if (!user) {
            const response = response403("User not authenticated");
            return res.status(response[0]).json(response[1]);
        }
        else {
            try {
                if (type && type == 'subadmin' && !user.is_admin) {
                    menu_name = menus.SUB_ADMINS
                }
                const roles = await Role.findOne({ _id: user.role }).populate({
                    path: 'permissions.menu',
                    select: 'name'
                });
                let permission = roles?.permissions.find((permission: any) => permission.menu.name == menu_name);

                const response = response403("Permission denied");
                if (user && (user.is_superadmin || user.is_admin)) {
                    next();
                    return;
                }
                else if (user &&
                    user.partner && (menu_name == menus.Grounds
                        || menu_name == menus.Employees
                        || menu_name == menus.Roles
                        || menu_name == menus.Slot_Times
                        || menu_name == menus.Slot_Bookings
                        || menu_name == menus.Expenses
                        || menu_name == menus.Reservation
                    )) {
                    next();
                    return;
                }
                else if (!permission) {
                    return res.status(response[0]).json(response[1]);
                }
                else if (!permission.delete) {
                    return res.status(response[0]).json(response[1]);
                }

                next();
            }
            catch (err) {
                console.log(err);
            }
        }
    }
}

export {
    menus,
    add,
    view,
    update,
    remove
}