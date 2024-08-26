import { FilterQuery } from "mongoose";
import { IChat } from "../types/types";
import { CustomRequest } from "../server";
import { Admin, Chat } from "../schemas/schema";
import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { response200 } from "../lib/helpers/utils";
import { Request, Response, Router } from "express";
import verifyJWT from "../middlewares/authentication";
import { menus, view } from "../middlewares/permission";
import { validateObjectData } from "../lib/helpers/validation";
import { create_chat_schema, chat_schema, send_message_schema, user_chat_schema, update_chat_schema, get_all_chat_schema } from "../validation/chatValidation";

const router = Router();

interface ChatQuery extends FilterQuery<IChat> {
    super_admin?: string;
    employee?: {
        $in: string[];
    },
    resolved?: string;
    chat_status?: {
        $in: string[]
    }
}

router.post('/create-chat', verifyJWT, asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqData = req.body;
    const user = req.user;

    if (!user) throw new CustomError("Session expired, please login to continue", 403);

    const validation = validateObjectData(create_chat_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const super_admin = await Admin.findOne({ is_superadmin: true, soft_delete: false });

    const chat = await Chat.create({
        user: user.id,
        super_admin,
        messages: [{
            sender: String(super_admin?._id),
            text: "Hello, How can i help you?"
        }],
    });

    const response = response200("", { id: chat._id });
    return res.status(response[0]).json(response[1]);
}));

router.get('/get-all-chats', [verifyJWT, view(menus.Support)], asyncHandler(async (req: CustomRequest, res: Response) => {
    let reqQuery = req.query;
    reqQuery = {
        ...reqQuery,
        chat_status: reqQuery.chat_status && JSON.parse(String(reqQuery.chat_status))
    }
    const user = req.user;

    if (!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(get_all_chat_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: ChatQuery = {};

    if ('is_superadmin' in user && user.is_superadmin) {
        where.super_admin = user.id;
    }

    if ('added_by' in user && user.added_by == 'SA') {
        where.employee = { $in: [user.id] };
    }

    if (reqQuery.chat_status && Array.isArray(reqQuery.chat_status) && reqQuery.chat_status.length != 0) {
        const all_status = reqQuery.chat_status.map((status) => {
            return String(status);
        });
        where.chat_status = { $in:  all_status}
    }

    const chats = (await Chat.find(where)
        .populate({ path: 'user', select: ['first_name', 'last_name', 'mobile'], options: { strictPopulate: false } })
    ).map((chat) => {
        return {
            id: chat._id,
            user: chat.user,
            messages: chat.messages,
            chat_status: chat.chat_status,
            resolved: chat.resolved
        }
    });

    const response = response200("", chats);
    return res.status(response[0]).json(response[1]);
}));

router.post('/send-message', verifyJWT, asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqData = req.body;
    const user = req.user;

    if (!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(send_message_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const message = {
        sender: String(user.id),
        text: reqData.text
    }

    await Chat.findByIdAndUpdate(reqData.chat_id, {
        $push: { messages: message }
    });

    const response = response200("Message sent", { id: reqData.chat_id });
    return res.status(response[0]).json(response[1]);
}));

router.get('/get-user-chat', [verifyJWT, view(menus.Support)], asyncHandler(async (req: Request, res: Response) => {
    const reqQuery = req.query;

    const validation = validateObjectData(user_chat_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const chat = await Chat.findById(reqQuery.chat_id);

    const data = {
        id: chat?._id,
        messages: chat?.messages,
        resolved: chat?.resolved,
        chat_status: chat?.chat_status
    }

    const response = response200("", data);
    return res.status(response[0]).json(response[1]);
}));

router.post('/update-chat', verifyJWT, asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    const validation = validateObjectData(update_chat_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    interface update_data {
        chat_status?: string;
        resolved?: boolean;
    }

    const data: update_data = {
        chat_status: reqData.chat_status,
    }
    reqData.chat_status == 'Solved' && (data.resolved = true);

    await Chat.findByIdAndUpdate(reqData.chat_id, { $set: data });

    const response = response200("Query resolved", { id: reqData.chat_id });
    return res.status(response[0]).json(response[1]);
}));

router.get('/incoming-chats', [verifyJWT, view(menus.Support)], asyncHandler(async (req: Request, res: Response) => {
    const chats = (await Chat.find({ resolved: false, chat_status: 'Unsolved', employee: { $size: 0 } })
        .populate({ path: 'user', select: ['first_name', 'last_name', 'mobile'], options: { strictPopulate: false } })
    ).map((chat) => {
        return {
            id: chat._id,
            user: chat.user,
        }
    });

    const response = response200("Incoming chats", chats);
    return res.status(response[0]).json(response[1]);
}));

//For user side only
router.get('/chat', verifyJWT, asyncHandler(async (req: Request, res: Response) => {
    const reqQuery = req.query;

    const validation = validateObjectData(chat_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where = {
        user: String(reqQuery.user_id),
        resolved: false,
    }

    const chat = await Chat.findOne(where);

    const data = {
        id: chat?._id,
        messages: chat?.messages,
        resolved: chat?.resolved
    }

    const response = response200("", data);
    return res.status(response[0]).json(response[1]);
}));

export default router;