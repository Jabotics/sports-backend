import Joi from 'joi';

const add_admin_schema = Joi.object({
    city: Joi.string().required(),
    email: Joi.string().email().required(),
});

const add_subadmin_schema = Joi.object({
    city: Joi.string().required(),
    email: Joi.string().email().required(),
    venue: Joi.array().items(Joi.string().required()).required(),
});

const get_all_admins_schema = Joi.object({
    search: Joi.string(),
    limit: Joi.number().positive(),
    offset: Joi.number().positive().allow(0)
});

const update_admin_schema = Joi.object({
    city: Joi.string(),
    is_active: Joi.boolean(),
    id: Joi.string().required(),
    last_name: Joi.string().min(2),
    first_name: Joi.string().min(2),
    mobile: Joi.string().pattern(new RegExp('[0-9]{7,10}')),
});

const update_subadmin_schema = Joi.object({
    is_active: Joi.boolean(),
    id: Joi.string().required(),
    last_name: Joi.string().min(2),
    first_name: Joi.string().min(2),
    venue: Joi.array().items(Joi.string()),
    salary: Joi.number().positive().allow(0),
    mobile: Joi.string().pattern(new RegExp('[0-9]{7,10}')),
});

const remove_admin_schema = Joi.array().items(Joi.string().required()).required();

export {
    add_admin_schema,
    add_subadmin_schema,
    update_admin_schema,
    remove_admin_schema,
    get_all_admins_schema,
    update_subadmin_schema,
}