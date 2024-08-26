import Joi from 'joi';

const slot_dates = Joi.object({
    date: Joi.date().required(),
    slots: Joi.array().items(Joi.string().required()).required()
});

const payment_details = Joi.object({
    payment_date: Joi.date().required(),
    amount: Joi.number().positive().required(),
    payment_mode: Joi.string().required().valid('Online', 'Cash'),
})

const reserve_slot_schema = Joi.object({
    first_name: Joi.string().required().max(20),
    last_name: Joi.string().required().max(20),
    mobile: Joi.string().required(),
    city: Joi.string().required(),
    venue: Joi.string().required(),
    ground: Joi.string().required(),
    total_amount: Joi.number().positive().required(),
    discount: Joi.number().positive().allow(0),
    slot_dates: Joi.array().items(slot_dates).required(),
    payment_details: Joi.array().items(payment_details).required(),
});

const get_reserved_slots_schema = Joi.object({
    city: Joi.string(),
    limit: Joi.number().positive(),
    venue: Joi.array().items(Joi.string()),
    ground: Joi.array().items(Joi.string()),
    offset: Joi.number().positive().allow(0)
});

const get_reservation_details = Joi.object({
    id: Joi.string().required()
})

const update_reservation_schema = Joi.object({
    id: Joi.string().required(),
    total_amount: Joi.number().positive(),
    discount: Joi.number().positive().allow(0),
    payment_details: Joi.array().items(payment_details)
});

const cancel_reservation_slot = Joi.object({
    reservation_id: Joi.string().required(),    
    slot_id: Joi.string().required(),
    booking_id: Joi.string().required()
});

const cancel_reservation_schema = Joi.object({
    reservation_id: Joi.string().required(),
});

const cancel_booking_schema = Joi.object({
    reservation_id: Joi.string().required(),
    booking_id: Joi.string().required()
});

const update_reservation_slot = Joi.object({
    date: Joi.date(),
    slot_id: Joi.string().required(),
    slots: Joi.array().items(Joi.string()),
    reservation_id: Joi.string().required(),
});

const add_new_reservation_slot = Joi.object({
    reservation_id: Joi.string().required(),
    slot_dates: Joi.array().items(slot_dates).required()   
});

const remove_reservation_schema = Joi.array().items(Joi.string().required()).required();

export {
    reserve_slot_schema,
    cancel_booking_schema,
    get_reservation_details,
    cancel_reservation_slot,
    update_reservation_slot,
    add_new_reservation_slot,
    get_reserved_slots_schema,
    cancel_reservation_schema,
    update_reservation_schema,
    remove_reservation_schema
}