import Joi from 'joi';

const permission_schema = Joi.object({
    menu: Joi.string().required(),
    add: Joi.boolean().required(),
    view: Joi.boolean().required(),
    update: Joi.boolean().required(),
    delete: Joi.boolean().required(),
});

const add_role_schema = Joi.object({
    city: Joi.string(),
    venue: Joi.string(),
    ground: Joi.string(),
    name: Joi.string().required().min(2).max(20),
    permissions: Joi.array().items(permission_schema).required()
});

const get_role_schema = Joi.object({
    city: Joi.string(),
    search: Joi.string(),
    ground: Joi.string(),
    is_active: Joi.boolean(),
    limit: Joi.number().positive(),
    venue: Joi.array().items(Joi.string()),
    offset: Joi.number().positive().allow(0),
});

const update_role_schema = Joi.object({
    city: Joi.string(),
    is_active: Joi.boolean(),
    id: Joi.string().required(),
    name: Joi.string().required().min(2).max(20),
    permissions: Joi.array().items(permission_schema),
    venue: Joi.string()
});

const remove_role_schema = Joi.array().items(Joi.string().required());

export {
    add_role_schema,
    get_role_schema,
    update_role_schema,
    remove_role_schema
}