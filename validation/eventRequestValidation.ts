import Joi from 'joi';

const add_event_request = Joi.object({
    event: Joi.string().required(),
    name: Joi.string().max(30).required(),
    mobile: Joi.string().max(10).required(),
});

export {
    add_event_request
}