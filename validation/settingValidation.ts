import Joi from 'joi';

const emp_profile_update_schema = Joi.object({
    id: Joi.string().required(),
    address: Joi.string().max(200),
    last_name: Joi.string().max(30),
    first_name: Joi.string().max(30),
    gender: Joi.string().valid('MALE', 'FEMALE'),
    mobile: Joi.string().pattern(new RegExp('[0-9]{7,10}')),
});

const forgot_password_schema = Joi.string().email().required();

const reset_password_schema = Joi.object({
    token: Joi.string().required(),
    email: Joi.string().email().required(),
    empType: Joi.string().required().valid('regular', 'admin'),
    password: Joi.string().min(8).pattern(new RegExp('^[a-zA-Z0-9!@#$%^&*()_+\\-=\\[\\]{};:\'"|,.<>\\/?]{3,30}$')).required().messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.pattern.base': 'Password must contain only letters, numbers, and special characters'
    }),
});

const change_password_schema = Joi.object({
    id: Joi.string().required(),
    old_password: Joi.string().min(8).pattern(new RegExp('^[a-zA-Z0-9!@#$%^&*()_+\\-=\\[\\]{};:\'"|,.<>\\/?]{3,30}$')).required().messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.pattern.base': 'Password must contain only letters, numbers, and special characters'
    }),
    new_password: Joi.string().min(8).pattern(new RegExp('^[a-zA-Z0-9!@#$%^&*()_+\\-=\\[\\]{};:\'"|,.<>\\/?]{3,30}$')).required().messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.pattern.base': 'Password must contain only letters, numbers, and special characters'
    }),
});

export {
    reset_password_schema,
    change_password_schema,
    forgot_password_schema,
    emp_profile_update_schema,
}