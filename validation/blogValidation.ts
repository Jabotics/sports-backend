import Joi from 'joi';

const blog_details = Joi.object({
    sub_title: Joi.string().max(100),
    description: Joi.string()
})

const create_blog_schema = Joi.object({
    image: Joi.string(),
    quotation: Joi.string().max(200),
    description: Joi.string().required(),
    title: Joi.string().required().max(100),
    details: Joi.array().items(blog_details),
});

const update_blog_schema = Joi.object({
    image: Joi.string(),
    featured: Joi.boolean(),
    is_active: Joi.boolean(),
    description: Joi.string(),
    id: Joi.string().required(),
    title: Joi.string().max(100),
    quotation: Joi.string().max(200),
    details: Joi.array().items(blog_details),
});

const get_blogs_schema = Joi.object({
    id: Joi.string(),
    featured: Joi.boolean(),
    limit: Joi.number().positive(),
    offset: Joi.number().positive().allow(0),    
});

const remove_blog_schema = Joi.array().items(Joi.string().required()).required()

export {
    get_blogs_schema,
    create_blog_schema,
    update_blog_schema,
    remove_blog_schema
}