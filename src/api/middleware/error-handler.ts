import { Request, Response, NextFunction } from 'express';
import { DomainError, InvalidStateTransitionError, InvariantViolationError } from '../../shared/types.js';

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static notFound(message = 'Ressource non trouvée'): ApiError {
    return new ApiError(404, message);
  }

  static badRequest(message: string): ApiError {
    return new ApiError(400, message);
  }

  static conflict(message: string): ApiError {
    return new ApiError(409, message);
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  // Erreurs API explicites
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Erreurs domain → 400/409
  if (err instanceof InvariantViolationError) {
    res.status(400).json({ error: err.message });
    return;
  }

  if (err instanceof InvalidStateTransitionError) {
    res.status(409).json({ error: err.message });
    return;
  }

  if (err instanceof DomainError) {
    res.status(400).json({ error: err.message });
    return;
  }

  // Erreurs inattendues → 500
  console.error('Erreur inattendue:', err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
}
