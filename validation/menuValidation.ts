import Joi from 'joi';

const add_menu_schema = Joi.string().required().max(20).min(3);

const get_menu_schema = Joi.object({
    id: Joi.string(),
    search: Joi.string(),
    orderBy: Joi.string(),
    is_active: Joi.boolean(),
    limit: Joi.number().positive(),
    offset: Joi.number().positive().allow(0),
    sort: Joi.string().valid('asc', 'desc'),
});

const update_menu_schema = Joi.object({
    is_active: Joi.boolean(),
    id: Joi.string().required(),
    name: Joi.string().max(20).min(3),
});

const remove_menu_schema = Joi.array().items(Joi.string().required());

export {
    add_menu_schema,
    get_menu_schema,
    update_menu_schema,
    remove_menu_schema
}