import Joi from 'joi';

const create_promocode_schema = Joi.object({    
    code: Joi.string().required(),
    city: Joi.string().required(),
    venue: Joi.string().required(),
    valid_upto: Joi.date().required(),
    applicable_for: Joi.string().required(),
    academies: Joi.array().items(Joi.string()),
    discount_amount: Joi.number().required().allow(0),
    grounds: Joi.array().items(Joi.string().required()),
    minimum_amount: Joi.number().required().positive(),
    discount_percentage: Joi.number().required().allow(0),
    max_use_limit: Joi.string().required().valid('Single', 'Multiple'),
    terms_and_conditions: Joi.array().items(Joi.string().required()).required(),
});

const get_promocode_schema = Joi.object({
    ground: Joi.string(),
    search: Joi.string(),
    academy: Joi.string(),
    membership: Joi.string(),
    limit: Joi.number().positive(),
    offset: Joi.number().positive().allow(0),
});

const update_promocode_schema = Joi.object({
    code: Joi.string(),
    city: Joi.string(),
    venue: Joi.string(),
    valid_upto: Joi.date(),
    is_active: Joi.boolean(),
    id: Joi.string().required(),
    discount_amount: Joi.number().allow(0),
    applicable_for: Joi.string().required(),
    minimum_amount: Joi.number().positive(),
    grounds: Joi.array().items(Joi.string()),
    discount_percentage: Joi.number().allow(0),
    academies: Joi.array().items(Joi.string()),
    memberships: Joi.array().items(Joi.string()),
    terms_and_conditions: Joi.array().items(Joi.string()),
    max_use_limit: Joi.string().valid('Single', 'Multiple'),
});

const remove_promocode_schema = Joi.array().items(Joi.string().required()).required();

const apply_promo_schema = Joi.object({
    academy: Joi.string(),
    membership: Joi.string(),
    id: Joi.string().required(),
    ground: Joi.string().required(),
    amount: Joi.number().required().positive(),
});

export {
    apply_promo_schema,
    get_promocode_schema,
    create_promocode_schema,
    update_promocode_schema,
    remove_promocode_schema,
}