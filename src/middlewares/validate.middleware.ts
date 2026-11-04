import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export const validate = (schema: ZodSchema) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      if ((validated as any).body) {
        req.body = (validated as any).body;
      }
      if ((validated as any).query) {
        // In Express 5, req.query is a read-only getter.
        // Merge validated query values into the existing query object instead.
        const validatedQuery = (validated as any).query;
        const currentQuery = req.query;
        // Clear existing keys and copy validated values
        for (const key of Object.keys(currentQuery)) {
          delete currentQuery[key];
        }
        Object.assign(currentQuery, validatedQuery);
      }
      if ((validated as any).params) {
        // In Express 5, req.params is also a read-only getter.
        // Override it using Object.defineProperty.
        Object.defineProperty(req, 'params', {
          value: (validated as any).params,
          writable: true,
          configurable: true,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};
