import Joi from 'joi';

const slots_schema = Joi.object({
    morning: Joi.array().items(Joi.string().min(5)),
    evening: Joi.array().items(Joi.string().min(5))
})

const add_membership_schema = Joi.object({
    slots: slots_schema,
    city: Joi.string().required(),
    sport: Joi.string().required(),
    venue: Joi.string().required(),
    ground: Joi.string().required(),
    max_buffer_days: Joi.number().positive(),
    yearly_fee: Joi.number().positive().allow(0),
    monthly_fee: Joi.number().positive().allow(0),
    quarterly_fee: Joi.number().positive().allow(0),
    half_yearly_fee: Joi.number().positive().allow(0),
    admission_fee: Joi.number().positive().required().allow(0),
});

const get_membership_schema = Joi.object({
    city: Joi.string(),
    sport: Joi.string(),
    search: Joi.string(),
    orderBy: Joi.string(),
    is_active: Joi.boolean(),
    limit: Joi.number().positive(),
    ground: Joi.array().items(Joi.string()),
    venue: Joi.array().items(Joi.string()),
    sort: Joi.string().valid('asc', 'desc'),
    offset: Joi.number().positive().allow(0),
});

const update_membership_schema = Joi.object({
    sport: Joi.string(),
    venue: Joi.string(),
    ground: Joi.string(),
    slots: slots_schema,
    is_active: Joi.boolean(),
    id: Joi.string().required(),
    max_buffer_days: Joi.number().positive(),
    yearly_fee: Joi.number().positive().allow(0),
    monthly_fee: Joi.number().positive().allow(0),
    admission_fee: Joi.number().positive().allow(0),
    quarterly_fee: Joi.number().positive().allow(0),
    half_yearly_fee: Joi.number().positive().allow(0),
});

const remove_membership_schema = Joi.array().items(Joi.string().required()).required()

export {
    add_membership_schema,
    get_membership_schema,
    update_membership_schema,
    remove_membership_schema,
}