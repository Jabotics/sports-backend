import Joi from 'joi';

const add_review_validation = Joi.object({    
    ground: Joi.string().required().min(10),
    review: Joi.string().required().min(2),
    rating: Joi.number().positive().max(1).valid(0,1,2,3,4,5).required()
});

const get_reviews_validation = Joi.object({
    limit: Joi.number().positive(),
    offset: Joi.number().positive().allow(0),
    ground: Joi.array().items(Joi.string())
});

const review_validation = Joi.object({
    ground: Joi.string().required()
})

const update_review_validation = Joi.object({
    id: Joi.string().required(),
    review: Joi.string().min(2),
    rating: Joi.number().positive().max(1).valid(0,1,2,3,4,5)
});

const remove_review_schema = Joi.array().items(Joi.string().required()).required()

export {
    review_validation,
    remove_review_schema,
    add_review_validation,
    get_reviews_validation,
    update_review_validation,
}