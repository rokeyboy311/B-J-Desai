import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Unhandled Server Error:', err);

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation Error',
      details: err.issues,
    });
    return;
  }

  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({ error: message });
};
