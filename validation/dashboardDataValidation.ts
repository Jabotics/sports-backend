import Joi from 'joi';

const ground_financials_schema = Joi.object({
    end_date: Joi.date(),
    academy: Joi.string(),
    start_date: Joi.date(),
    end_year: Joi.string().min(4),
    start_year: Joi.string().min(4),
    ground: Joi.string().required(),
    filter_type: Joi.string().valid('one_month', 'three_month', 'six_month', 'financial_year', 'custom'),
});

const venue_financials_schema = Joi.object({
    end_date: Joi.date(),
    academy: Joi.string(),
    start_date: Joi.date(),
    end_year: Joi.string().min(4),
    venue: Joi.string().required(),
    start_year: Joi.string().min(4),
    filter_type: Joi.string().valid('one_month', 'three_month', 'six_month', 'financial_year', 'custom'),
});

const city_financials_schema = Joi.object({
    end_date: Joi.date(),
    academy: Joi.string(),
    start_date: Joi.date(),
    end_year: Joi.string().min(4),
    city: Joi.string().required(),
    start_year: Joi.string().min(4),
    filter_type: Joi.string().valid('one_month', 'three_month', 'six_month', 'financial_year', 'custom'),
});

const finance_data_schema = Joi.object({
    end_date: Joi.date(),
    start_date: Joi.date(),
    end_year: Joi.string().min(4),
    start_year: Joi.string().min(4),
    filter_type: Joi.string().valid('one_month', 'three_month', 'six_month', 'financial_year', 'custom'),
});

const venue_wise_salary = Joi.object({
    city: Joi.string().required()
});

export {
    venue_wise_salary,
    finance_data_schema,
    city_financials_schema,
    venue_financials_schema,
    ground_financials_schema,
}