import Joi from 'joi';

const add_happy_customer = Joi.object({
    name: Joi.string().required().min(2).max(50),
    review: Joi.string().required().min(10).max(500)
});

const get_happy_customers = Joi.object({
    limit: Joi.number().positive(),
    offset: Joi.number().positive().allow(0),    
});

const update_happy_customer = Joi.object({
    is_active: Joi.boolean(),
    id: Joi.string().required(),
    name: Joi.string().min(2).max(50),
    review: Joi.string().min(2).max(500),
});

const remove_happy_customers = Joi.array().items(Joi.string().required()).required();

export {
    add_happy_customer,
    get_happy_customers,
    update_happy_customer,
    remove_happy_customers
}