import config from 'config';
import path from 'path';
import fs from 'node:fs/promises';
import { readdir } from 'fs/promises';
import { ISlotTime } from '../../types/types';
import { Types } from 'mongoose';
import { PathLike } from 'fs';
import { Academy, AcademyFee, Admin, BlacklistedToken, Chat, City, Customer, Employee, Event, Ground, Member, Membership, MembershipFee, Menu, PromoCode, Reservation, ReservationSlot, Role, SlotBooking, SlotTime, Student, Venue, Verification } from '../../schemas/schema';


//Utility Functions
const response200 = (message: string, data: object): [number, object] => {
    return [
        200,
        {
            status: 'success',
            message: message,
            data
        }
    ]
};

const response406 = (message: string, error?: object): [number, object] => {
    return [
        406,
        {
            status: 'fail',
            message,
            error
        }
    ]
}

const response403 = (message: string): [number, object] => {
    return [
        403,
        {
            status: 'fail',
            message
        }
    ]
}

const response401 = (message: string): [number, object] => {
    return [
        401,
        {
            status: 'fail',
            message
        }
    ]
}

const generateFrontEndURL = (type: string, email: string, token: string, empType: string): string => {
    return `${config.get('frontend_url')}/${type}?email=${email}&token=${token}&empType=${empType}`
};

const saveImage = async (uploadPath: string, name: string, buffer: Buffer) => {
    await fs.writeFile(`${uploadPath}/${name}`, buffer, 'binary');

    // const files = await readdir('./uploads/profile');
    // console.log(files);
    // console.log(path.resolve());
    // console.log(path.join(path.resolve(), '/uploads/profile'));
    // console.log(path.join(__dirname, "..", "uploads/profile"));
}

const findFile = async (id: string, searchPath: string) => {
    const matchedFile = [];
    const dir = searchPath.split('./')[1]
    const files = await readdir(searchPath);
    for (let file in files) {
        if (files[file].startsWith(id)) {
            matchedFile.push(`${dir}/${files[file]}`);
        }
    }
    return matchedFile;
}

const removeFile = async (searchPath: string, id: string) => {
    let matchedFile = "";
    const dir = searchPath.split('./')[1]
    const files = await readdir(searchPath);
    for (let file in files) {
        if (files[file].startsWith(id)) {
            matchedFile = (`${dir}/${files[file]}`);
        }
    }
    matchedFile.length != 0 && await fs.unlink(matchedFile);
}

const removeMultipleFiles = async (url: Array<PathLike>) => {
    for (let i in url) {
        await fs.unlink(url[i]);
    }
}

const capitalizeString = (str: string) => {
    return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

const checkGroundSlotTime = (groundId: Types.ObjectId, slots: Array<ISlotTime>) => {
    return slots.every((slot) => {
        return slot.ground.toString() == groundId.toString();
    });
}

const getUserData = async (userId: string, type: string) => {
    const emp = type == 'admin'
        ? await Admin.find({ _id: userId, soft_delete: false }).populate({ path: 'city', select: 'name', options: { strictPopulate: false } })
        : await Employee.find({ _id: userId, soft_delete: false }).populate({ path: 'city', select: 'name', options: { strictPopulate: false } });

    let payload = {
        id: emp[0]._id,
        email: emp[0].email,
        mobile: emp[0].mobile,
        gender: emp[0].gender,
        address: emp[0].address,
        last_name: emp[0].last_name,
        first_name: emp[0].first_name,
        profile_image: emp[0].profile_image,
        city: 'city' in emp[0] ? emp[0].city : null,
        venue: 'venue' in emp[0] ? emp[0].venue : null,
        role: 'role' in emp[0] ? emp[0].role : undefined,
        ground: 'ground' in emp[0] ? emp[0].ground : null,
        added_by: 'added_by' in emp[0] ? emp[0].added_by : undefined,
        menu: Array(),
    };

    const allMenus = (await Menu.find({ soft_delete: false })).map(menu => menu.name);
    if ('is_superadmin' in emp[0] && emp[0].is_superadmin) {
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
    else if ('is_admin' in emp[0] && emp[0].is_admin) {
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
    else if ('is_subadmin' in emp[0] && emp[0].is_subadmin) {
        const subadminMenu = allMenus.filter(menu => subadminMenuArr.includes(menu));
        subadminMenu.forEach(menu => {
            payload.menu.push({
                name: menu,
                add: true,
                view: true,
                update: true,
                delete: true
            })
        });
    }
    else if ('role' in emp[0] && emp[0].role) {
        const role = await Role.findById({ _id: emp[0].role }).populate({
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
    return payload;
}

const clearData = async (doc_name: string) => {
    switch (doc_name) {
        case 'ground':
            await Ground.deleteMany();
            break;
        case 'venue':
            await Venue.deleteMany();
            break;
        case 'city':
            await City.deleteMany();
            break;
        case 'employee':
            await Employee.deleteMany();
            break;
        case 'slot_time':
            await SlotTime.deleteMany();
            break;
        case 'customer':
            await Customer.deleteMany();
            break;
        case 'academy':
            await Academy.deleteMany();
            break;
        case 'membership':
            await Membership.deleteMany();
            break;
        case 'role':
            await Role.deleteMany();
            break;
        case 'event':
            await Event.deleteMany();
            break;
        case 'blacklisted_token':
            await BlacklistedToken.deleteMany();
            break;
        case 'verification':
            await Verification.deleteMany();
            break;
        case 'reservation':
            await Reservation.deleteMany();
            await ReservationSlot.deleteMany();
            break;
        case 'students':
            await Student.deleteMany();
            break;
        case 'members':
            await Member.deleteMany();
            break;
        case 'chat':
            await Chat.deleteMany();
            break;
        case 'all':
            await Ground.deleteMany();
            await Venue.deleteMany();
            // await City.deleteMany();
            await Employee.deleteMany();
            await SlotTime.deleteMany();
            await Customer.deleteMany();
            await Academy.deleteMany();
            await Membership.deleteMany();
            await Role.deleteMany();
            await Event.deleteMany();
            await BlacklistedToken.deleteMany();
            await Verification.deleteMany();
            await Student.deleteMany();
            await Member.deleteMany();
            await PromoCode.deleteMany();
            await SlotBooking.deleteMany();
            await AcademyFee.deleteMany();
            await MembershipFee.deleteMany();
            await Reservation.deleteMany();
            await ReservationSlot.deleteMany();
            break;
        default:
            break;
    }
}

//Utility Variables
const uploadPaths = {
    "blog": "./uploads/blogs",
    "venue": "./uploads/venue",
    "events": "./uploads/events",
    "sports": "./uploads/sports",
    "grounds": "./uploads/grounds",
    "profile": "./uploads/profile",
    "homepage": "./uploads/homepage",
    "customers": "./uploads/customers",
    "academies": "./uploads/academies",
}

const superadminMenuArr = ['CITIES', 'INQUIRIES', 'PAYMENTS', 'EVENTS', 'EMPLOYEES', 'ROLES', 'ADMINS', 'SPORTS', 'SUPPORT', 'CUSTOMERS', 'HOMEPAGE', 'EVENT_REQUEST', 'FAQ', 'BLOGS', 'HAPPY_CUSTOMERS', 'FEEDBACK', 'PARTNER_REQUEST'];

const adminMenuArr = ['EMPLOYEES', 'ROLES', 'VENUES', 'GROUNDS', 'SLOT_TIMES', 'ACADEMIES', 'MEMBERSHIPS', 'SUB_ADMINS', 'EXPENSES', 'SLOT_BOOKINGS', 'PROMO_CODES', 'STUDENTS', 'MEMBERS', 'RESERVATION']

const subadminMenuArr = ['GROUNDS', 'EMPLOYEES', 'SLOT_TIMES', 'ROLES', 'EXPENSES', 'SLOT_BOOKINGS', 'PROMO_CODES', 'STUDENTS', 'MEMBERS', 'RESERVATION'];

export {
    findFile,
    saveImage,
    clearData,
    removeFile,
    response200,
    response406,
    response403,
    response401,
    uploadPaths,
    getUserData,
    adminMenuArr,
    subadminMenuArr,
    capitalizeString,
    superadminMenuArr,
    generateFrontEndURL,
    checkGroundSlotTime,
    removeMultipleFiles,
}