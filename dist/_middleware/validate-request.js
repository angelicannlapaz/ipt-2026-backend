"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = validateRequest;
function validateRequest(schema) {
    return (req, res, next) => {
        const options = {
            abortEarly: false, // include all errors
            allowUnknown: true, // ignore unknown props
            stripUnknown: true // remove unknown props
        };
        const { error, value } = schema.validate(req.body, options);
        if (error) {
            return next(`Validation error: ${error.details.map((x) => x.message).join(', ')}`);
        }
        req.body = value;
        next();
    };
}
