import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 * Middleware de validation Zod pour le body de la requête.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.map(String).join('.'),
        message: issue.message,
      }));
      res.status(400).json({ error: 'Validation échouée', details });
      return;
    }
    req.body = result.data;
    next();
  };
}
