import Joi from 'joi';

const create_chat_schema = Joi.object({
    user_id: Joi.string().required(),    
});

const chat_schema = Joi.object({
    user_id: Joi.string().required()
});

const send_message_schema = Joi.object({
    chat_id: Joi.string().required(),
    text: Joi.string().required()
});

const user_chat_schema = Joi.object({
    chat_id: Joi.string().required()
});

const update_chat_schema = Joi.object({
    chat_id: Joi.string().required(),
    chat_status: Joi.string().valid('Solved', 'Unsolved').required()
});

const get_all_chat_schema = Joi.object({
    chat_status: Joi.array().items(Joi.string().valid('Unsolved', 'Solved'))
});

export {    
    chat_schema,
    user_chat_schema,
    update_chat_schema,
    create_chat_schema,
    send_message_schema,
    get_all_chat_schema
}