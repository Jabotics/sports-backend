import Joi from 'joi';

const expenses = Joi.object({
    desc: Joi.string().required(),
    amount: Joi.number().required().positive().allow(0)
});

const add_venue_expense = Joi.object({
    city: Joi.string().required(),
    venue: Joi.string().required(),
    year: Joi.string().required().regex(/^\d{4}$/),
    expenses: Joi.array().items(expenses).required(),
    month: Joi.string().required().valid('January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'),
});

const get_venue_expenses = Joi.object({
    month: Joi.string(),
    year: Joi.number(),
    search: Joi.string(),
    limit: Joi.number().positive(),
    offset: Joi.number().allow(0).positive(),
})

const update_venue_expense = Joi.object({
    id: Joi.string().required(),
    city: Joi.string().required(),
    venue: Joi.string().required(),
    year: Joi.string().regex(/^\d{4}$/),
    expenses: Joi.array().items(expenses).required(),
    month: Joi.string().valid('January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'),
});

const remove_venue_expenses = Joi.array().items(Joi.string().required()).required();

const download_expense_report = Joi.string().required();

export {
    add_venue_expense,
    get_venue_expenses,
    update_venue_expense,
    remove_venue_expenses,
    download_expense_report,
}