import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { BadRequestError } from '../utils/errors';

export const validate = (validations: ValidationChain[]) => {
    return async (req: Request, _res: Response, next: NextFunction) => {
        // Execute all validations
        await Promise.all(validations.map((validation) => validation.run(req)));

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const extractedErrors: string[] = [];
            errors.array().forEach((err: any) => extractedErrors.push(err.msg));

            return next(new BadRequestError(extractedErrors.join(', ')));
        }

        next();
    };
};
