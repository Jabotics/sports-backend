import Joi from 'joi';
import { image_validation_schema } from './imageValidation';

const slots_schema = Joi.object({
    morning: Joi.array().items(Joi.string()),
    evening: Joi.array().items(Joi.string()),
});

const add_academy_schema = Joi.object({
    slots: slots_schema,
    description: Joi.string(),
    video: Joi.string().allow(""),
    city: Joi.string().required(),
    sport: Joi.string().required(),
    venue: Joi.string().required(),
    ground: Joi.string().required(),
    name: Joi.string().required().min(2),
    yearly_fee: Joi.number().positive().allow(0),
    monthly_fee: Joi.number().positive().allow(0),
    quarterly_fee: Joi.number().positive().allow(0),
    half_yearly_fee: Joi.number().positive().allow(0),
    max_buffer_days: Joi.number().required().positive(),
    admission_fee: Joi.number().required().positive().allow(0),
    active_days: Joi.array().items(Joi.string().required().valid('sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat')).required(),
});

const update_academy_image_schema = Joi.array().items(image_validation_schema);

const get_academy_schema = Joi.object({
    city: Joi.string(),
    sport: Joi.string(),
    search: Joi.string(),
    orderBy: Joi.string(),
    limit: Joi.number().positive(),
    venue: Joi.array().items(Joi.string()),
    ground: Joi.array().items(Joi.string()),
    sort: Joi.string().valid('asc', 'desc'),
    offset: Joi.number().positive().allow(0),
    is_active: Joi.array().items(Joi.boolean()),
    ground_type: Joi.array().items(Joi.string()),
});

const update_academy_schema = Joi.object({
    video: Joi.string(),
    sport: Joi.string(),
    venue: Joi.string(),
    slots: slots_schema,
    ground: Joi.string(),
    is_active: Joi.boolean(),
    name: Joi.string().min(2),
    description: Joi.string(),
    id: Joi.string().required(),
    city: Joi.string().required(),
    max_buffer_days: Joi.number().positive(),
    yearly_fee: Joi.number().positive().allow(0),
    monthly_fee: Joi.number().positive().allow(0),
    admission_fee: Joi.number().positive().allow(0),
    quarterly_fee: Joi.number().positive().allow(0),
    half_yearly_fee: Joi.number().positive().allow(0),
    deleted_files: Joi.array().items(Joi.string().allow('')),
    active_days: Joi.array().items(Joi.string().valid('sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat')),
});

const remove_academy_schema = Joi.array().items(Joi.string().required()).required()

export {
    add_academy_schema,
    get_academy_schema,
    update_academy_schema,
    remove_academy_schema,
    update_academy_image_schema
}