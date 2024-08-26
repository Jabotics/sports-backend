import { Types } from "mongoose";
import { CustomRequest } from "../server";
import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { response200 } from "../lib/helpers/utils";
import { Request, Response, Router } from "express";
import verifyJWT from "../middlewares/authentication";
import { menus, view } from "../middlewares/permission";
import { addDays, addMonths, addYears } from 'date-fns';
import { validateObjectData } from "../lib/helpers/validation";
import { AcademyFee, Member, Student, MembershipFee } from "../schemas/schema";
import { get_academy_fee_details, get_membership_fee_details, pay_academy_fee, pay_membership_fee } from "../validation/feePaymentValidation";

const router = Router();

//Academy Fee APIs
router.post('/pay-academy-fee', verifyJWT ,asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqData = req.body;
    const user = req.user;

    if(!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(pay_academy_fee, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    
    const student = await Student.findOne({ _id: reqData.student });
    if(!student) throw new CustomError("Student not found", 404);
    if(String(user.id) != String(student.customer)) throw new CustomError("Permission denied", 403);
    var regExp = new RegExp("true");
    if(!regExp.test(String(student.is_active))) throw new CustomError("Your account is disabled, please contact admin", 406);        

    if('joined_academies' in user && Array.isArray(user.joined_academies) && user.joined_academies.length != 0 && !user.joined_academies.includes(String(student.academy))) throw new CustomError("You have not joined this academy", 406);    
    
    const payment_date = reqData.other_charges ? new Date() : new Date(student.due_date);
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

    const data = {
        student: reqData.student,
        subscription_type: reqData.subscription_type,
        academy_fee: reqData.academy_fee,
        other_charges: reqData?.other_charges,
        payment_date,
        due_date,
        payment_mode: reqData.payment_mode,
        academy: String(student.academy)
    };

    const payment = await AcademyFee.create(data);

    const student_data = {
        due_date,
        payment_date,
        readmission_required: reqData.other_charges && false
    }

    await Student.findByIdAndUpdate(reqData.student, student_data);

    const response = response200("Payment successfully received", { id: payment._id });
    return res.status(response[0]).json(response[1]);
}));

router.get('/get-academy-fee-details', [verifyJWT, view(menus.Students)], asyncHandler(async (req: Request, res: Response) => {
    const reqQuery = req.query;

    const validation = validateObjectData(get_academy_fee_details, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const fee_details = (await AcademyFee.find({ student: new Types.ObjectId(String(reqQuery.student_id)) })
        .populate({
            path: 'student',
            select: 'student_id',
            options: { strictPopulate: false },
            populate: { path: 'customer', select: ['first_name', 'last_name'], options: { strictPopulate: false } }
        }))
        .map((detail) => {
            return {
                student: detail.student,
                subscription_type: detail.subscription_type,
                payment_date: detail.payment_date.toDateString(),
                due_date: detail.due_date.toDateString(),
                academy_fee: detail.academy_fee,
                admission_fee: detail.admission_fee,                
                payment_mode: detail.payment_mode
            }
        });

    const response = response200("Payment details fetched", { fee_details });
    return res.status(response[0]).json(response[1]);
}));

//For user side
router.get('/academy-fee-details', verifyJWT ,asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqQuery = req.query;
    const user = req.user;

    if(!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(get_academy_fee_details, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const student = await Student.findById(reqQuery.student_id);
    if(!student) throw new CustomError("Student not found", 403);

    if(String(user.id) != String(student.customer)) throw new CustomError("Permission denied", 403);

    const fee_details = (await AcademyFee.find({ student: new Types.ObjectId(String(reqQuery.student_id)) })
        .populate({
            path: 'student',
            select: 'student_id',
            options: { strictPopulate: false },
            populate: { path: 'customer', select: ['first_name', 'last_name'], options: { strictPopulate: false } }
        }))
        .map((detail) => {
            return {                
                subscription_type: detail.subscription_type,
                payment_date: detail.payment_date.toDateString(),
                due_date: detail.due_date.toDateString(),
                academy_fee: detail.academy_fee,
                admission_fee: detail.admission_fee,                
                payment_mode: detail.payment_mode
            }
        });

    const response = response200("Payment details fetched", { fee_details });
    return res.status(response[0]).json(response[1]);
}));


//Membership Fee APIs
router.post('/pay-membership-fee', verifyJWT ,asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqData = req.body;
    const user = req.user;

    if(!user) throw new CustomError("Permission denied, please login again", 403);

    const validation = validateObjectData(pay_membership_fee, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const member = await Member.findOne({ _id: reqData.member });    
    if(!member)  throw new CustomError("Member not found", 404);
    if(String(user.id) != String(member.customer)) throw new CustomError("Permission denied, please login again", 403);
    var regExp = new RegExp("true");
    if(!regExp.test(String(member.is_active))) throw new CustomError("Your account is disabled, please contact admin", 406);

    if('joined_membership' in user && Array.isArray(user.joined_membership) && user.joined_membership.length != 0 && !user.joined_membership.includes(String(member.membership))) throw new CustomError("You have not joined this membership", 406);

    const payment_date = reqData.other_charges ? new Date() : new Date(member.due_date);
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

    const data = {
        member: reqData.member,
        subscription_type: reqData.subscription_type,
        membership_fee: reqData.membership_fee,
        joining_fee: reqData?.joining_fee,
        other_charges: reqData?.other_charges,
        payment_date,
        due_date,
        payment_mode: reqData.payment_mode,
        membership: String(member.membership)
    };

    const payment = await MembershipFee.create(data);

    const member_data = {
        due_date,
        payment_date,
    }

    await Member.findByIdAndUpdate(reqData.member, member_data);

    const response = response200("Payment successfully received", { id: payment._id });
    return res.status(response[0]).json(response[1]);
}));

router.get('/get-membership-fee-details', [verifyJWT, view(menus.Members)], asyncHandler(async (req: Request, res: Response) => {
    const reqQuery = req.query;

    const validation = validateObjectData(get_membership_fee_details, reqQuery);    
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const fee_details = (await MembershipFee.find({ member: new Types.ObjectId(String(reqQuery.member_id)) })
        .populate({
            path: 'member',
            select: 'member_id',
            options: { strictPopulate: false },
            populate: { path: 'customer', select: ['first_name', 'last_name'], options: { strictPopulate: false } }
        }))
        .map((detail) => {
            return {
                member: detail.member,
                subscription_type: detail.subscription_type,
                payment_date: detail.payment_date.toDateString(),
                due_date: detail.due_date.toDateString(),
                membership_fee: detail.membership_fee,
                joining_fee: detail.joining_fee,
                other_charges: detail.other_charges,
                payment_mode: detail.payment_mode
            }
        });

    const response = response200("Payment details fetched", { fee_details });
    return res.status(response[0]).json(response[1]);
}));

//For user side
router.get('/membership-fee-details', verifyJWT ,asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqQuery = req.query;
    const user = req.user;

    if(!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(get_membership_fee_details, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);    

    const member = await Member.findById(reqQuery.member_id);
    if(!member) throw new CustomError("Member not found", 403);

    if(String(user.id) != String(member.customer)) throw new CustomError("Permission denied", 403);

    const fee_details = (await MembershipFee.find({ member: String(reqQuery.member_id) })
        .populate({
            path: 'member',
            select: 'member_id',
            options: { strictPopulate: false },
            populate: { path: 'customer', select: ['first_name', 'last_name'], options: { strictPopulate: false } }
        }))
        .map((detail) => {
            return {
                member: detail.member,
                subscription_type: detail.subscription_type,
                payment_date: detail.payment_date.toDateString(),
                due_date: detail.due_date.toDateString(),
                membership_fee: detail.membership_fee,
                joining_fee: detail.joining_fee,
                other_charges: detail.other_charges,
                payment_mode: detail.payment_mode
            }
        });

    const response = response200("Payment details fetched", { fee_details });
    return res.status(response[0]).json(response[1]);
}));

export default router;
