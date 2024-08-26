import Joi from 'joi';

const add_inquiry_schema = Joi.object({
    first_name: Joi.string().required().max(30),
    last_name: Joi.string().required().max(30),
    description: Joi.string().required().max(250),
    mobile: Joi.string().required().pattern(new RegExp('[0-9]{7,10}')),
    inquiry_type: Joi.string().required().valid('Booking', 'Academy', 'Membership'),
});

const get_all_inquiries_schema = Joi.object({
    search: Joi.string(),
    solved: Joi.boolean(),
    orderBy: Joi.string(),
    limit: Joi.number().positive(),
    sort: Joi.string().valid('asc', 'desc'),
    offset: Joi.number().positive().allow(0),
    is_active: Joi.array().items(Joi.boolean()),
    inquiry_type: Joi.array().items(Joi.string().valid('Booking', 'Academy', 'Membership'))
});

const update_inquiry_schema = Joi.object({
    solved: Joi.boolean(),
    id: Joi.string().required(),
});

const remove_inquiry_schema = Joi.array().items(Joi.string().required());

export {
    add_inquiry_schema,
    update_inquiry_schema,
    remove_inquiry_schema,
    get_all_inquiries_schema,
}