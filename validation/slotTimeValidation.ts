import Joi from 'joi';

const price_schema = Joi.object({
    sun: Joi.number().required().positive().allow(0),
    mon: Joi.number().required().positive().allow(0),
    tue: Joi.number().required().positive().allow(0),
    wed: Joi.number().required().positive().allow(0),
    thu: Joi.number().required().positive().allow(0),
    fri: Joi.number().required().positive().allow(0),
    sat: Joi.number().required().positive().allow(0)
})

const add_slot_time_schema = Joi.object({
    ground: Joi.string().required(),    
    venue: Joi.string().required(),
    slot: Joi.string().min(10).required(),
    price: price_schema,
});

const get_slot_times_schema = Joi.object({
    search: Joi.string(),
    is_active: Joi.boolean(),
    limit: Joi.number().positive(),
    ground: Joi.array().items(Joi.string()),
    offset: Joi.number().positive().allow(0),
});

const update_slot_time_schema = Joi.object({
    price: price_schema,
    ground: Joi.string(),
    is_active: Joi.boolean(),
    slot: Joi.string().min(10),
    id: Joi.string().required(),
});

const remove_slot_time_schema = Joi.array().items(Joi.string().required()).required();

const get_available_slots_schema = Joi.object({
    ground: Joi.string().required(),
    city: Joi.string().required(),
    active_days: Joi.array().items(Joi.string().valid('sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'))
});

const available_slots_for_event = Joi.object({
    ground: Joi.string().required(),
    start_date: Joi.date().required(),
    end_date: Joi.date().required(),
})

export {
    add_slot_time_schema,
    get_slot_times_schema,
    update_slot_time_schema,
    remove_slot_time_schema,
    available_slots_for_event,
    get_available_slots_schema,
}