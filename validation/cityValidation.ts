import Joi from 'joi';

const add_city_schema = Joi.string().required().max(50)

const get_city_schema = Joi.object({
    id: Joi.string(),
    search: Joi.string(),
    orderBy: Joi.string(),
    is_active: Joi.boolean(),
    limit: Joi.number().positive(),
    sort: Joi.string().valid('asc', 'desc'),
    offset: Joi.number().positive().allow(0),
});

const update_city_schema = Joi.object({
    is_active: Joi.boolean(),
    name: Joi.string().max(50),
    id: Joi.string().required(),
});

const remove_city_schema = Joi.array().items(Joi.string().required()).required();

const fetch_cities_schema = Joi.object({
    id: Joi.string(),
    search: Joi.string(),
})

export {
    add_city_schema,
    get_city_schema,
    update_city_schema,
    remove_city_schema,
    fetch_cities_schema,
}