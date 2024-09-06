import Joi from 'joi';

const become_partner_validation = Joi.object({
    first_name: Joi.string().min(2).max(30).required(),
    last_name: Joi.string().min(2).max(30).required(),
    email: Joi.string().email().required(),
    mobile: Joi.string().pattern(new RegExp('[0-9]{7,10}')),
    venue_name: Joi.string().min(2).max(50).required(),
    address: Joi.string().max(100).required(),   
    city: Joi.string() .required()
});

const get_partner_request = Joi.object({
    approved: Joi.boolean(),
    city: Joi.string(),
    limit: Joi.number().positive(),
    offset: Joi.number().positive().allow(0),
});

const update_partner_request = Joi.object({
    id: Joi.string().required(),
    status: Joi.string().valid('Accepted', 'Rejected').required(),
    first_name: Joi.string().min(2).max(30),
    last_name: Joi.string().min(2).max(30),
    email: Joi.string().email(),
    mobile: Joi.string().pattern(new RegExp('[0-9]{7,10}')),
    password: Joi.string().min(8).pattern(new RegExp('^[a-zA-Z0-9!@#$%^&*()_+\\-=\\[\\]{};:\'"|,.<>\\/?]{3,30}$')).messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.pattern.base': 'Password must contain only letters, numbers, and special characters'
    }),
    city: Joi.string() .required()
});

const remove_request_schema = Joi.array().items(Joi.string().required()).required();

export {
    get_partner_request,    
    remove_request_schema,
    update_partner_request,
    become_partner_validation,
}