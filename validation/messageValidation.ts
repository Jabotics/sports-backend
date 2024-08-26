import Joi from 'joi';

const add_message_schema = Joi.object({
    chat_id: Joi.string().required(),
    sender_id: Joi.string().required(),
    message: Joi.string().required()
})

const get_messages_schema = Joi.object({
    chat_id: Joi.string().required()
});

export {
    add_message_schema,
    get_messages_schema
}