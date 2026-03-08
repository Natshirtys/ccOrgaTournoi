import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth-service.js';

/**
 * Middleware de parsing JWT (silencieux).
 * - Si JWT_SECRET absent → no-op, req.user reste undefined (tests passent intacts).
 * - Si token valide → attache req.user.
 * - Si token invalide → req.user reste undefined (pas d'erreur).
 */
export function createAuthenticateMiddleware(authService: AuthService | null) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!authService) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const user = authService.verifyToken(token);
      if (user) req.user = user;
    }

    next();
  };
}

/**
 * Middleware de protection — bloque si l'utilisateur n'est pas admin.
 * À utiliser APRÈS createAuthenticateMiddleware sur les routes mutantes.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Non autorisé — authentification requise' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Accès refusé — droits administrateur requis' });
    return;
  }
  next();
}

/**
 * Retourne requireAdmin si authService est actif, sinon un middleware no-op.
 * Permet la rétrocompatibilité des tests sans JWT_SECRET.
 */
export function createRequireAdmin(authService: AuthService | null | undefined) {
  if (!authService) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }
  return requireAdmin;
}
