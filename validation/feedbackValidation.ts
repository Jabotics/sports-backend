import Joi from 'joi';

const add_feedback_schema = Joi.object({
    mobile: Joi.string().required().max(10),
    last_name: Joi.string().required().max(30),
    feedback: Joi.string().required().max(400),
    first_name: Joi.string().required().max(30),
    topic: Joi.string().required().valid('Pay & Play', 'Academy', 'Membership', 'Other'),
});

const fetch_feedbacks_schema = Joi.object({
    limit: Joi.number().positive(),
    offset: Joi.number().positive().allow(0),
    topic: Joi.string().valid('Pay & Play', 'Academy', 'Membership', 'Other')
});

const remove_feedback_schema = Joi.array().items(Joi.string().required()).required();

export {
    add_feedback_schema,
    fetch_feedbacks_schema,
    remove_feedback_schema
}