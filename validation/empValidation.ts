import Joi from 'joi';

const add_employee_schema = Joi.object({
    email: Joi.string().required().email().max(60),
    venue: Joi.array().items(Joi.string())
})

const emp_registration_schema = Joi.object({
    token: Joi.string().required(),
    email: Joi.string().email().required(),
    last_name: Joi.string().required().min(2),
    first_name: Joi.string().required().min(2),
    gender: Joi.string().required().valid('Male', 'Female'),
    empType: Joi.string().required().valid('regular', 'admin'),
    mobile: Joi.string().required().pattern(new RegExp('[0-9]{7,10}')),
    password: Joi.string().min(8).pattern(new RegExp('^[a-zA-Z0-9!@#$%^&*()_+\\-=\\[\\]{};:\'"|,.<>\\/?]{3,30}$')).required().messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.pattern.base': 'Password must contain only letters, numbers, and special characters'
    }),
});

const get_all_employees_schema = Joi.object({
    search: Joi.string(),
    limit: Joi.number().positive(),
    offset: Joi.number().positive().allow(0),
    is_active: Joi.array().items(Joi.boolean()),
});

const update_employee_schema = Joi.object({
    role: Joi.string(),
    is_active: Joi.boolean(),
    id: Joi.string().required(),
    last_name: Joi.string().min(2),
    first_name: Joi.string().min(2),
    venue: Joi.array().items(Joi.string()),
    ground: Joi.array().items(Joi.string()),
    salary: Joi.number().positive().allow(0),
    gender: Joi.string().valid('Male', 'Female'),
    mobile: Joi.string().pattern(new RegExp('[0-9]{7,10}')),
});

const remove_employee_schema = Joi.array().items(Joi.string().required()).required();

const employee_schema = Joi.object({
    id: Joi.string().required()
});

export {
    employee_schema,
    add_employee_schema,
    remove_employee_schema,
    update_employee_schema,
    emp_registration_schema,
    get_all_employees_schema,
}