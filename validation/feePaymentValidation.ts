import Joi from 'joi';

const pay_academy_fee = Joi.object({
    student: Joi.string().required(),
    academy_fee: Joi.number().required().positive(),
    other_charges: Joi.number().positive().default(0),
    payment_mode: Joi.string().required().valid('Online', 'Offline'),
    subscription_type: Joi.string().valid('Monthly','Quarterly', 'Half_Yearly', 'Yearly').required(),
})

const pay_membership_fee = Joi.object({    
    member: Joi.string().required(),
    other_charges: Joi.number().positive().default(0),
    membership_fee: Joi.number().positive().required(),
    payment_mode: Joi.string().required().valid('Online', 'Offline'),
    subscription_type: Joi.string().valid('Monthly','Quarterly', 'Half_Yearly', 'Yearly').required(),
});

const get_membership_fee_details = Joi.object({
    member_id: Joi.string().required().min(2)
});

const get_academy_fee_details = Joi.object({
    student_id: Joi.string().required().min(2)
});

export {
    pay_academy_fee,
    pay_membership_fee,
    get_academy_fee_details,
    get_membership_fee_details,
}