import Joi from 'joi';

const income_expenses = Joi.object({
    desc: Joi.string().required(),
    amount: Joi.number().required().allow(0).positive(),
});

const add_event_schema = Joi.object({
    description: Joi.string(),
    end_date: Joi.date().required(),
    start_date: Joi.date().required(),
    registration_status: Joi.string(),
    // all_days: Joi.boolean().required(),
    name: Joi.string().min(5).required(),
    sports: Joi.array().items(Joi.string()),
    duration: Joi.string().min(5).required(),
    slots: Joi.array().items(Joi.string()),
    grounds: Joi.array().items(Joi.string().required()).required(),
});

const get_event_schema = Joi.object({
    search: Joi.string(),
    is_active: Joi.array().items(Joi.boolean()),
    limit: Joi.number().positive(),
    offset: Joi.number().positive().allow(0),
    registration_status: Joi.array().items(Joi.string().valid('Open', 'Closed')),
    event_status: Joi.array().items(Joi.string().valid('Upcoming', 'Completed'))
});

const update_event_schema = Joi.object({
    end_date: Joi.date(),
    start_date: Joi.date(),
    is_active: Joi.boolean(),
    name: Joi.string().min(5),
    id: Joi.string().required(),
    image: Joi.string().allow(''),
    duration: Joi.string().min(5),
    registration_status: Joi.string(),
    slots: Joi.array().items(Joi.string()),
    sports: Joi.array().items(Joi.string()),
    grounds: Joi.array().items(Joi.string()),
    income: Joi.array().items(income_expenses),
    expenses: Joi.array().items(income_expenses),
    description: Joi.string()
});

const remove_events_schema = Joi.array().items(Joi.string().required()).required();

export {
    add_event_schema,
    get_event_schema,
    update_event_schema,
    remove_events_schema
}

