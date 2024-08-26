import Joi from 'joi';

const add_member_schema = Joi.object({
    customer: Joi.string(),
    mobile: Joi.string().max(10),
    city: Joi.string().required(),
    sport: Joi.string().required(),
    venue: Joi.string().required(),
    ground: Joi.string().required(),
    membership: Joi.string().required(),
    email: Joi.string().required().max(50),
    other_charges: Joi.number().positive(),
    address: Joi.string().required().max(300),
    last_name: Joi.string().required().max(20),
    first_name: Joi.string().required().max(20),
    "guardian's_name": Joi.string().required().max(50),
    membership_fee: Joi.number().positive().required(),
    "guardian's_mobile": Joi.string().required().max(10),
    payment_mode: Joi.string().valid('Online', 'Offline'),
    joining_fee: Joi.number().positive().required().allow(0),
    shift: Joi.string().required().valid('morning', 'evening'),
    subscription_type: Joi.string().required().valid('Monthly', 'Quarterly', 'Half_Yearly', 'Yearly'),
});

const get_member_schema = Joi.object({
    city: Joi.string(),
    venue: Joi.array().items(Joi.string()),
    ground: Joi.array().items(Joi.string()),
    limit: Joi.number().positive(),
    offset: Joi.number().positive().allow(0),
});

const get_joined_memberships = Joi.object({    
    city: Joi.string()
});

const update_member_schema = Joi.object({
    id: Joi.string().required(),
    is_active: Joi.boolean()
});

export {
    add_member_schema,
    get_member_schema,
    update_member_schema,
    get_joined_memberships,
}