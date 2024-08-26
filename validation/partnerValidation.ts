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
    approved: Joi.boolean().required()
});

export {
    get_partner_request,
    update_partner_request,
    become_partner_validation,
}