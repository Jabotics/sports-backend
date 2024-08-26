import Joi from 'joi';

const add_sport_schema = Joi.string().required().min(2);

const add_image_schema = Joi.object({
    "fieldname": Joi.string().required(),
    "originalname": Joi.string().required(),
    "encoding": Joi.string().required(),
    "mimetype": Joi.string()
        .valid("image/png", "image/jpg", "image/jpeg")
        .required(),
    "buffer": Joi.binary().required(),
    "size": Joi.number()
        .less(1024 * 1024) // 1 MB
        .required(),
});

const get_sports_schema = Joi.object({
    id: Joi.array().items(Joi.string()),
    search: Joi.string(),
    is_active: Joi.boolean(),
    limit: Joi.number().positive().integer(),
    offset: Joi.number().positive().integer(),
});

const update_sports_schema = Joi.object({
    is_active: Joi.boolean(),
    name: Joi.string().min(2),
    id: Joi.string().required(),
});

const remove_sport_schema = Joi.array().items(Joi.string().required());

export {
    add_sport_schema,
    add_image_schema,
    get_sports_schema,
    remove_sport_schema,
    update_sports_schema,
}