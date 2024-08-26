import Joi from 'joi';

const validateObjectData = (schema: Joi.ObjectSchema, data: object): Joi.ValidationResult => {
    return schema.validate(data);
}

const validateArrayData = (schema: Joi.ArraySchema, data: Array<any>): Joi.ValidationResult => {
    return schema.validate(data);
}

const validateStringData = (schema: Joi.StringSchema, data: string): Joi.ValidationResult => {
    return schema.validate(data);
}

export {
    validateObjectData,
    validateArrayData,
    validateStringData
}