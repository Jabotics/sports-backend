import Joi from 'joi';

const customer_login_schema = Joi.object({
    mobile: Joi.string().pattern(new RegExp('[0-9]{7,10}'))
});

const validate_otp_schema = Joi.object({
    id: Joi.string().required(),
    otp: Joi.number().required()
});

const get_customer_schema = Joi.object({
    search: Joi.string(),
    is_active: Joi.boolean(),
    limit: Joi.number().positive(),
    offset: Joi.number().positive().allow(0)
});

const add_to_favorites_schema = Joi.object({
    customer_id: Joi.string().required(),
    ground_id: Joi.string().required()
});

const update_user_profile = Joi.object({
    first_name: Joi.string(),
    last_name: Joi.string(),
    mobile: Joi.string(),
    email: Joi.string()
});

const customer_schema = Joi.object({
    id: Joi.string().required()
})

export {
    customer_schema,
    get_customer_schema,
    validate_otp_schema,
    update_user_profile,
    customer_login_schema,
    add_to_favorites_schema,
}