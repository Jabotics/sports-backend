import Joi from 'joi';
import { image_validation_schema, video_validation_schema } from './imageValidation';

const dimension_schema = Joi.object({
    width: Joi.string().min(2),
    length: Joi.string().min(2),
    boundary_type: Joi.string().min(2),
});

const rules_schema = Joi.object({
    allowed: Joi.array().items(Joi.string()),
    not_allowed: Joi.array().items(Joi.string()),
})

const add_ground_schema = Joi.object({
    video: Joi.string(),
    rules: rules_schema,
    slots: Joi.boolean(),
    academy: Joi.boolean(),
    membership: Joi.boolean(),
    dimensions: dimension_schema,
    city: Joi.string().required(),
    venue: Joi.string().required(),
    multisports_support: Joi.boolean(),
    name: Joi.string().required().min(2),
    supported_sports: Joi.array().items(Joi.string()),
    ground_type: Joi.string().required().valid('Indoor', 'Outdoor'),
    amenities: Joi.array().items(Joi.string().valid('AC', 'Sports Kit', 'CCTV', 'Trainer', 'Changing Room', 'Locker', 'Steam Bath', 'Score Board', 'Parking', 'Canteen', 'Drinking Water', 'Flood Lights', 'Washroom', 'Umpires', 'Sight Screen', 'Pavilion')),
});

const fetch_grounds_schema = Joi.object({
    search: Joi.string(),
    orderBy: Joi.string(),
    academy: Joi.boolean(),
    membership: Joi.boolean(),
    limit: Joi.number().positive(),
    multisports_support: Joi.boolean(),
    venue: Joi.array().items(Joi.string()),
    sort: Joi.string().valid('asc', 'desc'),
    offset: Joi.number().positive().allow(0),
    is_active: Joi.array().items(Joi.boolean()),
    ground_type: Joi.array().items(Joi.string().valid('Indoor', 'Outdoor')),
});

const update_ground_schema = Joi.object({
    venue: Joi.string(),
    video: Joi.string(),
    rules: rules_schema,
    slots: Joi.boolean(),
    academy: Joi.boolean(),
    is_active: Joi.boolean(),
    is_popular: Joi.boolean(),
    membership: Joi.boolean(),
    name: Joi.string().min(2),
    id: Joi.string().required(),
    dimensions: dimension_schema,
    multisports_support: Joi.boolean(),
    supported_sports: Joi.array().items(Joi.string()),
    deleted_files: Joi.array().items(Joi.string()),
    ground_type: Joi.string().valid('Indoor', 'Outdoor'),
    amenities: Joi.array().items(Joi.string().valid('AC', 'Sports Kit', 'CCTV', 'Trainer', 'Changing Room', 'Locker', 'Steam Bath', 'Score Board', 'Parking', 'Canteen', 'Drinking Water', 'Flood Lights', 'Washroom', 'Umpires', 'Sight Screen', 'Pavilion'))
});

const update_ground_image_schema = Joi.array().items(image_validation_schema);

const remove_ground_schema = Joi.array().items(Joi.string().required()).required();

const grounds_schema = Joi.object({
    id: Joi.string(),
    city: Joi.string(),
    new: Joi.boolean(),
    academy: Joi.boolean(),
    membership: Joi.boolean(),
    is_popular: Joi.boolean(),
    limit: Joi.number().positive(),
    venue: Joi.array().items(Joi.string()),
    offset: Joi.number().positive().allow(0),
    supported_sports: Joi.array().items(Joi.string()),
    ground_type: Joi.array().items(Joi.string().valid('Indoor', 'Outdoor')),
})

export {
    grounds_schema,
    add_ground_schema,
    fetch_grounds_schema,
    remove_ground_schema,
    update_ground_schema,
    update_ground_image_schema,
}