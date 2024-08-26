import Joi from 'joi';

const add_banner_schema = Joi.object({
    type: Joi.string().required().valid("event", "academy", "membership", "booking"),
    url: Joi.string()
});

const update_banner_schema = Joi.object({
    id: Joi.string().required(),
    url: Joi.string(),
    is_active: Joi.boolean(),
    type: Joi.string().valid("event", "academy", "membership", "booking"),
});

const remove_banner_schema = Joi.array().items(Joi.string().required()).required()

export {
    add_banner_schema,
    update_banner_schema,
    remove_banner_schema
}