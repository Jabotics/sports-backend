import Joi from 'joi';

const add_faq_schema = Joi.object({
    answer: Joi.string().required().min(5).max(500),
    question: Joi.string().required().min(5).max(80),
    type: Joi.string().required().valid('Booking', 'Academy', 'Membership', 'Others')
});

const get_faq_schema = Joi.object({
    limit: Joi.number().positive(),
    offset: Joi.number().positive().allow(0),
    is_active: Joi.array().items(Joi.string()),
    type: Joi.string().valid('Booking', 'Academy', 'Membership', 'Others')
});

const update_faq_schema = Joi.object({
    is_active: Joi.boolean(),
    id: Joi.string().required().min(10),
    answer: Joi.string().min(5).max(500),
    question: Joi.string().min(5).max(80),
    type: Joi.string().valid('Booking', 'Academy', 'Membership', 'Others')
});

const remove_faq_schema = Joi.array().items(Joi.string().required()).required();

export {
    add_faq_schema,
    get_faq_schema,
    update_faq_schema,
    remove_faq_schema
}