import sharp from "sharp";
import { CustomRequest } from "../server";
import { FilterQuery, Types } from "mongoose";
import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { Request, Response, Router } from "express";
import verifyJWT from "../middlewares/authentication";
import { addDays, addMonths, addYears } from 'date-fns';
import { IAcademyStudents, PaymentMode } from "../types/types";
import { validateObjectData } from "../lib/helpers/validation";
import { menus, update, view } from "../middlewares/permission";
import { image_validation_schema } from "../validation/imageValidation";
import { Academy, AcademyFee, Customer, Ground, Sport, Student, Venue } from "../schemas/schema";
import { capitalizeString, findFile, removeFile, response200, saveImage, uploadPaths } from "../lib/helpers/utils";
import { add_student_schema, get_joined_academies, get_student_schema, update_student_schema } from "../validation/academyStudentsValidation";

const router = Router();

function generateStudentId() {
    const prefix = 'D3-';
    const randomNum = Math.floor(1000 + Math.random() * 9000); // Generates a random 4-digit number
    return `${prefix}${randomNum}`;
}

interface StudentsQuery extends FilterQuery<IAcademyStudents> {
    _id?: Types.ObjectId;
    venue?: {
        $in: Types.ObjectId[];
    };
    ground?: {
        $in: Types.ObjectId[];
    };
    city?: Types.ObjectId;
    academy?: Types.ObjectId;
    $or?: Array<{ [key: string]: any }>;
}

interface update_student_data {
    is_active?: boolean;
    due_date?: Date;
}

interface customerSearchQuery {
    path: string,
    select: string[],
    options: {
        strictPopulate: boolean
    },
    filter?: {
        $or: [
            {
                first_name: { $regex: string, $options: string }
            },
            {
                last_name: { $regex: string, $options: string }
            }
        ]
    }
}

router.get('/get-students', [verifyJWT, view(menus.Students)], asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqQuery = req.query;
    const user = req.user;

    if (!user) throw new CustomError("Permission denied", 403);

    //Update student whose due_date is over
    const students = await Student.find({ soft_delete: false }).populate({ path: 'academy', select: 'max_buffer_days', options: { strictPopulate: false } });
    let stuIds = students.filter((student: IAcademyStudents) => {
        let date = new Date();
        date.setHours(23);
        date.setMinutes(59);
        date.setSeconds(59);
        date.setMilliseconds(999);
        let max_buffer_days = 'max_buffer_days' in student.academy && typeof student.academy.max_buffer_days == 'number' && student.academy.max_buffer_days || 0;
        if (max_buffer_days >= 30) {
            return addMonths(student.due_date, 1) < date;
        }
        else {
            return addDays(student.due_date, max_buffer_days) < date
        }
    });
    if (stuIds.length != 0) {
        const where = { _id: { $in: stuIds } };
        const data = { $set: { is_active: false } };
        await Student.updateMany(where, data);
    }

    //Validating the req body
    const validation = validateObjectData(get_student_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: StudentsQuery = {
        soft_delete: false,
    }

    'city' in user && user.city && (where.city = new Types.ObjectId(String(user.city._id)));
    if ('ground' in user && Array.isArray(user.ground) && user.ground.length != 0) {
        const groundIds = user.ground.map((id) => {
            return new Types.ObjectId(String(id));
        });
        where.ground = { $in: groundIds }
    }

    if ('venue' in user && Array.isArray(user.venue) && user.venue.length != 0) {
        const venueIds = user.venue.map((id) => {
            return new Types.ObjectId(String(id));
        });
        where.venue = { $in: venueIds }
    }

    reqQuery.city && (where.city = new Types.ObjectId(String(reqQuery.city)));
    if (reqQuery.ground && Array.isArray(reqQuery.ground) && reqQuery.ground.length != 0) {
        const groundIds = reqQuery.ground.map((id) => {
            return new Types.ObjectId(String(id));
        });
        where.ground = { $in: groundIds }
    }
    if (reqQuery.venue && Array.isArray(reqQuery.venue) && reqQuery.venue.length != 0) {
        const venueIds = reqQuery.venue.map((id) => {
            return new Types.ObjectId(String(id));
        });
        where.venue = { $in: venueIds }
    }

    reqQuery.academy && (where.academy = new Types.ObjectId(String(reqQuery.academy)));

    let customerQuery: customerSearchQuery = {
        path: 'customer',
        select: ['first_name', 'last_name', 'email', 'mobile', "guardian's_name", "guardian's_mobile", 'profile_img', 'doc_img'],
        options: {
            strictPopulate: false
        }
    }

    if (reqQuery.search) {
        customerQuery.filter = {
            $or: [
                {
                    first_name: {
                        $regex: String(reqQuery.search),
                        $options: 'i'
                    }
                },
                {
                    last_name: {
                        $regex: String(reqQuery.search),
                        $options: 'i'
                    }
                }
            ]
        },
        where.$or = [
            {student_unique_id: {$regex: String(reqQuery.search), $options: 'i'}}
        ]
    }

    const academyDetails = (await Student.find(where)
        .populate({ path: 'city', select: 'name', options: { strictPopulate: false } })
        .populate({ path: 'slot', select: 'slot', options: { strictPopulate: false } })
        .populate({ path: 'sport', select: 'name', options: { strictPopulate: false } })
        .populate({ path: 'ground', select: 'name', options: { strictPopulate: false } })
        .populate({ path: 'academy', select: 'name', options: { strictPopulate: false } })
        .populate({ path: 'venue', select: ['name', 'address'], options: { strictPopulate: false } })
        .populate(customerQuery)
        .skip(Number(reqQuery.offset) || 0)
        .limit(Number(reqQuery.limit) || 10000))
        .filter(booking => booking.customer)
        .map((details) => {
            return {
                id: details._id,
                student_unique_id: details.student_unique_id,
                sport: details.sport,
                customer: details.customer,
                shift: details.shift,
                academy: details.academy,
                ground: details.ground,
                venue: details.venue,
                city: details.city,
                last_payment_date: details.payment_date.toDateString(),
                payment_due_date: details.due_date.toDateString(),
                is_active: details.is_active
            }
        });

    const count = await Student.countDocuments(where);

    const response = response200("Academy students fetched successfully", { count, academy_details: academyDetails });
    return res.status(response[0]).json(response[1]);
}));

router.post('/update-student', [verifyJWT, update(menus.Students)], asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqData = req.body;
    const user = req.user;

    if (!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(update_student_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);


    const student = await Student.findOne({ _id: reqData.id, soft_delete: false });
    if (!student) throw new CustomError("Student not found", 404);

    if ('ground' in user && Array.isArray(user.ground) && user.ground.length != 0 && !user.ground.includes(String(student.ground))) throw new CustomError("Permission denied", 403);
    if ('venue' in user && Array.isArray(user.venue) && user.venue.length != 0 && !user.venue.includes(String(student.venue))) throw new CustomError("Permission denied", 403);

    const data: update_student_data = {
        is_active: reqData?.is_active
    }

    var regExp = new RegExp("true");
    let due_date = new Date();
    if (regExp.test(String(String(reqData.is_active))) && student.due_date < due_date) {
        due_date.setHours(23);
        due_date.setMinutes(59);
        due_date.setSeconds(59);
        due_date.setMilliseconds(999);
        data.due_date = due_date;
    }

    await Student.findByIdAndUpdate(reqData.id, data);

    const response = response200("Student updated successfully", { id: reqData.id });
    return res.status(response[0]).json(response[1]);
}));

// User side
router.post('/join-academy', verifyJWT, asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqData = req.body;
    const user = req.user;
    const reqImages = req.files;

    if (!user) throw new CustomError("Permission denied", 406);

    const validation = validateObjectData(add_student_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if (!reqData.customer) throw new CustomError("customer is required", 406);

    if (!reqImages) throw new CustomError("image is required", 406);

    if (Array.isArray(reqImages) && reqImages?.length != 0) {
        const imgValidation = validateObjectData(image_validation_schema, reqImages[0]);
        if (imgValidation.error) throw new CustomError(imgValidation.error.message, 406, imgValidation.error.details[0].context?.key);
    }

    const academy = await Academy.findOne({ _id: reqData.academy, soft_delete: false, is_active: true });
    if (!academy) throw new CustomError("Academy does not exist or is disabled", 406);
    if (String(academy.ground) != reqData.ground) throw new CustomError("Ground does not have the academy you selected", 406);

    const venue = await Venue.findOne({ _id: reqData.venue, soft_delete: false, is_active: true });
    if (!venue) throw new CustomError("Venue does not exist or is disabled", 406);

    const ground = await Ground.findOne({ _id: reqData.ground, soft_delete: false, is_active: true });
    if (!ground) throw new CustomError("Ground does not exist or is disabled", 406);
    if (!ground.academy) throw new CustomError("Ground does not support academy", 406);
    if (String(ground.venue) != String(reqData.venue)) throw new CustomError("Venue does not have the ground you selected", 406);

    const sport = await Sport.countDocuments({ _id: reqData.sport, is_active: true, soft_delete: false });
    if (sport == 0) throw new CustomError("Sport does not exist or is disabled", 406);
    if (academy.sport.toString() != reqData.sport) throw new CustomError("Academy does not support the sport you selected", 406);

    if (String(user.id) != String(reqData.customer)) throw new CustomError("Something went wrong", 403);

    const findExistingStudent = await Student.find({
        customer: user.id,
        academy: reqData.academy,
        sport: reqData.sport,
        soft_delete: false
    });

    if (findExistingStudent.length != 0) throw new CustomError("Student already registered for this academy", 406);

    // creating payment and due dates
    const payment_date = new Date();
    payment_date.setHours(0);
    payment_date.setMinutes(0);
    payment_date.setSeconds(0);
    payment_date.setMilliseconds(0);

    //Finding due date from the payment date according to their subscription type
    let due_date = new Date();
    switch (reqData.subscription_type) {
        case "Quarterly":
            due_date = addMonths(payment_date, 3);
            break;
        case "Half_Yearly":
            due_date = addMonths(payment_date, 6);
            break;
        case "Yearly":
            due_date = addYears(payment_date, 1);
            break;
        default:
            due_date = addDays(payment_date, 30);
    }
    due_date.setHours(23);
    due_date.setMinutes(59);
    due_date.setSeconds(59);
    due_date.setMilliseconds(999);

    //Creating students
    const student_data = {
        due_date,
        payment_date,
        city: reqData.city,
        sport: reqData.sport,
        shift: reqData.shift,
        venue: reqData.venue,
        ground: reqData.ground,
        academy: reqData.academy,
        customer: reqData.customer,
        student_unique_id: generateStudentId(),
    }

    const student = await Student.create(student_data);

    if (Array.isArray(reqImages) && reqImages.length != 0) {
        await removeFile(uploadPaths.customers, reqData.id)
        for (let i in reqImages) {
            await saveImage(uploadPaths.customers, `${student._id}-${reqImages[i].originalname}`, reqImages[i].buffer);
        }
        let url = await findFile(student._id, uploadPaths.customers);
        let profile_img = url.find((img) => img.includes("profile"));
        let doc_img = url.find((img) => img.includes("doc"));
        await Customer.findByIdAndUpdate(reqData.customer, { profile_img, doc_img });
    }

    //Updating customer data
    const customer_data = {
        first_name: capitalizeString(reqData.first_name),
        last_name: capitalizeString(reqData.last_name),
        email: reqData.email,
        "guardian's_name": capitalizeString(reqData["guardian's_name"]),
        mobile: reqData?.mobile,
        "guardian's_mobile": reqData["guardian's_mobile"],
        address: reqData.address,
    }
    await Customer.findByIdAndUpdate(reqData.customer, {
        $set: customer_data,
        $push: { joined_academies: reqData.academy }
    });

    //Fee details
    const fee_data = {
        due_date,
        payment_date,
        student: student._id,
        academy: reqData.academy,
        payment_mode: PaymentMode.ONLINE,
        academy_fee: reqData.academy_fee,
        admission_fee: reqData.admission_fee,
        subscription_type: reqData.subscription_type,
    }
    await AcademyFee.create(fee_data);

    const response = response200("Registered successfully", { id: student._id });
    return res.status(200).json(response[1]);
}));

router.get('/joined-academies', verifyJWT, asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqQuery = req.query;
    const user = req.user;

    if (!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(get_joined_academies, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: StudentsQuery = {
        soft_delete: false,
        customer: user.id,
    }

    if (reqQuery.academy) {
        where.academy = new Types.ObjectId(String(reqQuery.academy));
    }
    else {
        delete where.academy;
    }

    const academies_details = (await Student.find(where)
        .populate({ path: 'academy', select: 'name', options: { strictPopulate: false } })
        .populate({ path: 'sport', select: 'name', options: { strictPopulate: false } })
        .populate({ path: 'ground', select: 'name', options: { strictPopulate: false } })
        .populate({ path: 'venue', select: 'name', options: { strictPopulate: false } })
        .populate({ path: 'slot', select: 'slot', options: { strictPopulate: false } })
        .populate({ path: 'city', select: 'slot', options: { strictPopulate: false } })
    ).map((detail: IAcademyStudents) => {
        return {
            id: detail._id,
            student_unique_id: detail.student_unique_id,
            academy: 'name' in detail.academy && detail.academy.name,
            city: 'name' in detail.city && detail.city.name,
            ground: 'name' in detail.ground && detail.ground.name,
            venue: 'name' in detail.venue && detail.venue.name,
            last_payment_date: detail.payment_date.toDateString(),
            payment_due_date: detail.due_date.toDateString(),
            joined_date: detail.createdAt.toDateString(),
            shift: detail.shift,
            is_active: detail.is_active
        }
    });

    const response = response200("Joined academies", academies_details);
    return res.status(response[0]).json(response[1]);
}));

export default router;