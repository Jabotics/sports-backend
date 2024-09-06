import Joi from 'joi';
import { image_validation_schema } from './imageValidation';

const add_venue_schema = Joi.object({
    city: Joi.string().required(),
    name: Joi.string().min(2).required(),
    address: Joi.string().min(5).required(),
    geo_location: Joi.string().required().allow(String()),    
    supported_sports: Joi.array().items(Joi.string().required()).required(),
});

const get_venue_schema = Joi.object({
    city: Joi.string(),
    search: Joi.string(),
    orderBy: Joi.string(),
    limit: Joi.number().positive(),
    id: Joi.array().items(Joi.string()),
    sort: Joi.string().valid('asc', 'desc'),
    offset: Joi.number().positive().allow(0),
    is_active: Joi.array().items(Joi.boolean()),
});

const update_venue_schema = Joi.object({
    is_active: Joi.boolean(),
    name: Joi.string().min(2),
    id: Joi.string().required(),
    address: Joi.string().min(5),
    city: Joi.string().required(),
    geo_location: Joi.string().allow(String()),
    deleted_files: Joi.array().items(Joi.string()),    
    supported_sports: Joi.array().items(Joi.string()),
});

const update_venue_image_schema = Joi.array().items(image_validation_schema);

const remove_venue_schema = Joi.array().items(Joi.string().required()).required();

const venues_schema = Joi.object({
    city: Joi.string()
})

export {
    venues_schema,
    add_venue_schema,
    get_venue_schema,
    update_venue_schema,
    remove_venue_schema,
    update_venue_image_schema,
}