import Joi from 'joi';

const add_slot_booking_schema = Joi.object({
    date: Joi.date().required(),
    city: Joi.string().required(),
    venue: Joi.string().required(),
    ground: Joi.string().required(),
    customer: Joi.string().required(),
    promo_code: Joi.array().items(Joi.string()),
    slots: Joi.array().items(Joi.string().required()).required(),
});

const book_slot_schema = Joi.object({
    date: Joi.date().required(),
    city: Joi.string().required(),
    venue: Joi.string().required(),
    ground: Joi.string().required(),
    customer: Joi.string().required(),
    amount: Joi.number().positive().required(),
    promo_code: Joi.array().items(Joi.string()),
    slots: Joi.array().items(Joi.string().required()).required(),
});

const get_available_slots_schema = Joi.object({
    date: Joi.date().required(),
    ground: Joi.string().required(),
});

const get_booking_schema = Joi.object({
    id: Joi.string(),
    city: Joi.string(),
    customer: Joi.string(),
    limit: Joi.number().positive(),
    offset: Joi.number().positive().allow(0),
    // venue: Joi.array().items(Joi.string().required()),
    ground: Joi.array().items(Joi.string().required()),
    search: Joi.string()
});

const update_booking_schema = Joi.object({
    id: Joi.string().required(),
    date: Joi.date().required(),
    venue: Joi.string().required(),
    ground: Joi.string().required(),
    customer: Joi.string().required(),
    slots: Joi.array().items(Joi.string()),
    booking_status: Joi.string().valid('Cancelled'),
});

export {
    book_slot_schema,
    get_booking_schema,    
    update_booking_schema,
    add_slot_booking_schema,
    get_available_slots_schema,
}