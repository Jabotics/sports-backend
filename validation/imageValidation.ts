import Joi from 'joi';

const image_validation_schema = Joi.object({
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

const video_validation_schema = Joi.object({
    "fieldname": Joi.string().required(),
    "originalname": Joi.string().required(),
    "encoding": Joi.string().required(),
    "mimetype": Joi.string()
        .valid("video/mp4", "video/avi", "video/mkv")
        .required(),
    "buffer": Joi.binary().required(),
    "size": Joi.number()
        .less(50 * 1024 * 1024) // 50 MB
        .required(),
});

export {
    image_validation_schema,
    video_validation_schema,
}