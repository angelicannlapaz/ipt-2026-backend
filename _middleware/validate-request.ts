import { Request, Response, NextFunction } from 'express';

export default validateRequest;

function validateRequest(schema: any) {
    return (req: Request, res: Response, next: NextFunction) => {
        const options = {
            abortEarly: false, // include all errors
            allowUnknown: true, // ignore unknown props
            stripUnknown: true // remove unknown props
        };

        const { error, value } = schema.validate(req.body, options);

        if (error) {
            return next(
                `Validation error: ${error.details.map((x: any) => x.message).join(', ')}`
            );
        }

        req.body = value;
        next();
    };
}