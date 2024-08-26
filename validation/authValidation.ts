import Joi from 'joi';

const login_schema = Joi.object({
    password: Joi.string().required().min(5),
    email: Joi.string().email().required().max(50),
});

export {
    login_schema
}