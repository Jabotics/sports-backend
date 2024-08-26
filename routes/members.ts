import sharp from "sharp";
import { CustomRequest } from "../server";
import { Response, Router } from "express";
import { FilterQuery, Types } from "mongoose";
import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import verifyJWT from "../middlewares/authentication";
import { IMembers, PaymentMode } from "../types/types";
import { addDays, addMonths, addYears } from 'date-fns';
import { validateObjectData } from "../lib/helpers/validation";
import { add, menus, update, view } from "../middlewares/permission";
import { image_validation_schema } from "../validation/imageValidation";
import { Customer, Ground, Member, Membership, Sport, MembershipFee, Venue } from "../schemas/schema";
import { capitalizeString, findFile, removeFile, response200, saveImage, uploadPaths } from "../lib/helpers/utils";
import { add_member_schema, get_joined_memberships, get_member_schema, update_member_schema } from "../validation/memberValidation";

const router = Router();

function generateMemberId() {
    const prefix = 'D3-';
    const randomNum = Math.floor(1000 + Math.random() * 9000); // Generates a random 4-digit number
    return `${prefix}${randomNum}`;
}

interface MembersQuery extends FilterQuery<IMembers> {
    _id?: Types.ObjectId;
    venue?: {
        $in: Types.ObjectId[];
    };
    ground?: {
        $in: Types.ObjectId[];
    };
    city?: Types.ObjectId;
}

interface member_data {
    is_active?: boolean;
    due_date?: Date;
}

router.post('/add-member', [verifyJWT, add(menus.Members)] ,asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqData = req.body;
    const user = req.user;
    const reqImage = req.files;

    if(!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(add_member_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if(!reqData.payment_mode) throw new CustomError("Payment mode is required", 406);

    if (!reqImage) throw new CustomError("image is required", 406);

    if (Array.isArray(reqImage) && reqImage?.length != 0) {
        const imgValidation = validateObjectData(image_validation_schema, reqImage[0]);
        if (imgValidation.error) throw new CustomError(imgValidation.error.message, 406, imgValidation.error.details[0].context?.key);
    }

    if ('venue' in user && Array.isArray(user.venue) && user.venue.length != 0 && !user.venue.includes(reqData.venue)) throw new CustomError("Permission denied", 403);
    if ('ground' in user && Array.isArray(user.ground) && user.ground.length != 0 && !user.ground.includes(reqData.ground)) throw new CustomError("Permission denied", 403);

    const membership = await Membership.findOne({ _id: reqData.membership, soft_delete: false, is_active: true });
    if (!membership) throw new CustomError("Academy does not exist or is disabled", 406);
    if (String(membership.ground) != reqData.ground) throw new CustomError("Ground does not have the membership you selected", 406);

    const venue = await Venue.findOne({ _id: reqData.venue, soft_delete: false, is_active: true });
    if (!venue) throw new CustomError("Venue does not exist or is disabled", 406);

    const ground = await Ground.findOne({ _id: reqData.ground, soft_delete: false, is_active: true });
    if (!ground) throw new CustomError("Ground does not exist or is disabled", 406);
    if (!ground.academy) throw new CustomError("Ground does not support membership", 406);
    if (String(ground.venue) != String(reqData.venue)) throw new CustomError("Venue does not have the ground you selected", 406);

    const sport = await Sport.countDocuments({ _id: reqData.sport, is_active: true, soft_delete: false });
    if (sport == 0) throw new CustomError("Sport does not exist or is disabled", 406);
    if (membership.sport.toString() != reqData.sport) throw new CustomError("Membership does not support the sport you selected", 406);

    const findExistingMember = await Member.find({
        customer: reqData.customer,
        membership: reqData.membership,
        sport: reqData.sport,
        soft_delete: false
    });

    if (findExistingMember.length != 0) throw new CustomError("Member name or email already registered for this membership", 406);

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
    await Customer.findByIdAndUpdate(reqData.customer, customer_data);

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
    const member_data = {
        due_date,
        payment_date,
        city: reqData.city,
        slot: reqData.slot,
        sport: reqData.sport,
        venue: reqData.venue,
        ground: reqData.ground,
        customer: reqData.customer,
        member_unique_id: generateMemberId(),
        membership: reqData.membership,
    }

    const member = await Member.create(member_data);

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
        await saveImage(uploadPaths.profile, `${member._id}-member-${reqImage[0].originalname}`, compressedBuffer);
        let url = await findFile(member._id, uploadPaths.profile);
        await Member.findByIdAndUpdate(member._id, { img: url[0] });
    }

    //Fee details
    const fee_data = {
        member: member._id,
        subscription_type: reqData.subscription_type,
        payment_date,
        due_date,
        other_charges: reqData?.other_charges,
        joining_fee: reqData.joining_fee,
        payment_mode: reqData.payment_mode,
        membership_fee: reqData.membership_fee,
    }
    await MembershipFee.create(fee_data);

    const response = response200("Member added successfully", { id: member._id });
    return res.status(200).json(response[1]);
}));

router.get('/get-members', [verifyJWT, view(menus.Members)], asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqQuery = req.query;
    const user = req.user;

    if (!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(get_member_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

       //Update student whose due_date is over
       const members = await Member.find({ soft_delete: false }).populate({path: 'academy', select: 'max_buffer_days', options: {strictPopulate: false}});    
       let stuIds = members.filter((member: IMembers) => {
           let date = new Date();
           date.setHours(23);
           date.setMinutes(59);
           date.setSeconds(59);
           date.setMilliseconds(999);        
           let max_buffer_days = 'max_buffer_days' in member.membership && typeof member.membership.max_buffer_days == 'number' && member.membership.max_buffer_days || 0;        
           if(max_buffer_days >= 30) {
               return addMonths(member.due_date, 1) < date;
           }
           else {
               return addDays(member.due_date, max_buffer_days) < date
           }
       });
       if (stuIds.length != 0) {
           const where = { _id: { $in: stuIds } };
           const data = { $set: { is_active: false } };
           await Member.updateMany(where, data);
       }

    const where: MembersQuery = {
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

    const memberDetails = (await Member.find(where)
        .populate({ path: 'city', select: 'name', options: { strictPopulate: false } })
        .populate({ path: 'slot', select: 'slot', options: { strictPopulate: false } })
        .populate({ path: 'sport', select: 'name', options: { strictPopulate: false } })
        .populate({ path: 'ground', select: 'name', options: { strictPopulate: false } })
        .populate({ path: 'academy', select: 'name', options: { strictPopulate: false } })
        .populate({ path: 'venue', select: ['name', 'address'], options: { strictPopulate: false } })
        .populate({ path: 'customer', select: ['first_name', 'last_name', 'email', 'mobile', "guardian's_name", "guardian's_mobile"], options: { strictPopulate: false } })
        .limit(Number(reqQuery.limit) || 10000)
        .skip(Number(reqQuery.offset) || 0)
    )
        .map((details) => {
            return {
                id: details._id,
                member_unique_id: details.member_unique_id,
                sport: details.sport,
                customer: details.customer,
                membership: details.membership,
                shift: details.shift,
                ground: details.ground,
                venue: details.venue,
                city: details.city,
                last_payment_date: details.payment_date.toDateString(),
                payment_due_date: details.due_date.toDateString(),
                is_active: details.is_active
            }
        });

    const count = await Member.countDocuments(where);

    const response = response200("Member fetched successfully", { count, member_details: memberDetails });
    return res.status(response[0]).json(response[1]);
}));

router.post('/update-member', [verifyJWT, update(menus.Members)] ,asyncHandler(async (req: CustomRequest, res: Response)=>{
    const reqData = req.body;
    const user = req.user;

    if(!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(update_member_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const member = await Member.findOne({_id: reqData.id, soft_delete: false});
    if(!member) throw new CustomError("Member not found", 404);

    if('ground' in user && Array.isArray(user.ground) && user.ground.length != 0 && !user.ground.includes(String(member.ground))) throw new CustomError("Permission denied", 403);
    if('venue' in user && Array.isArray(user.venue) && user.venue.length != 0 && !user.venue.includes(String(member.venue))) throw new CustomError("Permission denied", 403);

    const data: member_data = {
        is_active: reqData?.is_active
    }

    var regExp = new RegExp("true");
    let due_date = new Date();
    if(regExp.test(String(String(reqData.is_active))) && member.due_date < due_date) {        
        due_date.setHours(23);
        due_date.setMinutes(59);
        due_date.setSeconds(59);
        due_date.setMilliseconds(999);
        data.due_date = due_date;
    }

    await Member.findByIdAndUpdate(reqData.id, data);

    const response = response200("Member updated successfully", {id: reqData.id});
    return res.status(response[0]).json(response[1]);
}));

//User side
router.post('/join-membership', verifyJWT , asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqData = req.body;
    const user = req.user;
    const reqImages = req.files;

    if(!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(add_member_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if (!reqImages) throw new CustomError("image is required", 406);

    if (Array.isArray(reqImages) && reqImages?.length != 0) {
        const imgValidation = validateObjectData(image_validation_schema, reqImages[0]);
        if (imgValidation.error) throw new CustomError(imgValidation.error.message, 406, imgValidation.error.details[0].context?.key);
    }

    const membership = await Membership.findOne({ _id: reqData.membership, soft_delete: false, is_active: true });
    if (!membership) throw new CustomError("Academy does not exist or is disabled", 406);
    if (String(membership.ground) != reqData.ground) throw new CustomError("Ground does not have the membership you selected", 406);

    const venue = await Venue.findOne({ _id: reqData.venue, soft_delete: false, is_active: true });
    if (!venue) throw new CustomError("Venue does not exist or is disabled", 406);

    const ground = await Ground.findOne({ _id: reqData.ground, soft_delete: false, is_active: true });
    if (!ground) throw new CustomError("Ground does not exist or is disabled", 406);
    if (!ground.membership) throw new CustomError("Ground does not support membership", 406);
    if (String(ground.venue) != String(reqData.venue)) throw new CustomError("Venue does not have the ground you selected", 406);

    const sport = await Sport.countDocuments({ _id: reqData.sport, is_active: true, soft_delete: false });
    if (sport == 0) throw new CustomError("Sport does not exist or is disabled", 406);
    if (membership.sport.toString() != reqData.sport) throw new CustomError("Membership does not support the sport you selected", 406);

    if(String(user.id) != String(reqData.customer)) throw new CustomError("Something went wrong", 403);

    const findExistingMember = await Member.find({
        customer: reqData.customer,
        membership: reqData.membership,
        sport: reqData.sport,
        soft_delete: false
    });

    if (findExistingMember.length != 0) throw new CustomError("Member already registered for this membership", 406);

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
        $push: {joined_memberships: reqData.membership}
    });

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
    const member_data = {
        due_date,
        payment_date,
        city: reqData.city,        
        shift: reqData.shift,
        sport: reqData.sport,
        venue: reqData.venue,
        ground: reqData.ground,
        customer: reqData.customer,
        membership: reqData.membership,
        member_unique_id: generateMemberId(),        
    }

    const member = await Member.create(member_data);

    if (Array.isArray(reqImages) && reqImages.length != 0) {
        await removeFile(uploadPaths.customers, reqData.id)
        for (let i in reqImages) {            
            await saveImage(uploadPaths.customers, `${reqData.customer._id}-${reqImages[i].originalname}`, reqImages[i].buffer);
        }        
        let url = await findFile(reqData.customer._id, uploadPaths.customers);
        let profile_img = url.find((img)=> img.includes("profile"));
        let doc_img = url.find((img)=> img.includes("doc"));        
        await Customer.findByIdAndUpdate(reqData.customer, { profile_img, doc_img });
    }

    //Fee details
    const fee_data = {
        member: member._id,
        subscription_type: reqData.subscription_type,
        payment_date,
        due_date,
        other_charges: reqData?.other_charges,
        joining_fee: reqData.joining_fee,
        membership_fee: reqData.membership_fee,
        payment_mode: PaymentMode.ONLINE,
        membership: String(membership._id)
    }
    let x = await MembershipFee.create(fee_data);        

    const response = response200("Registered successfully", { id: member._id });
    return res.status(200).json(response[1]);
}));

router.get('/joined-memberships', verifyJWT ,asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqQuery = req.query;
    const user = req.user;

    if(!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(get_joined_memberships, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const memberships_details = (await Member.find({
        customer: user.id,
        soft_delete: false
    })
    .populate({path: 'slot', select: 'slot', options: {strictPopulate: false}})
    .populate({path: 'city', select: 'name', options: {strictPopulate: false}})
    .populate({path: 'sport', select: 'name', options: {strictPopulate: false}})
    .populate({path: 'venue', select: 'name', options: {strictPopulate: false}})
    .populate({path: 'ground', select: 'name', options: {strictPopulate: false}})
    ).map((detail: IMembers)=>{
        return {
            id: detail._id,
            member_id: detail.member_unique_id,
            city: 'name' in detail.city && detail.city.name,
            ground: 'name' in detail.ground && detail.ground.name,
            venue: 'name' in detail.venue && detail.venue.name,
            sport: 'name' in detail.sport && detail.sport.name,
            shift: detail.shift,         
            last_payment_date: detail.payment_date.toDateString(),
            payment_due_date: detail.due_date.toDateString(),
            joined_date: detail.createdAt.toDateString()
        }
    });

    const response = response200("Joined memberships", memberships_details);
    return res.status(response[0]).json(response[1]);
}));

export default router;