import { Router } from 'express';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { validateBody } from '../middleware/validation.js';
import { AuthService } from '../auth/auth-service.js';
import { requireAdmin } from '../auth/auth-middleware.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export function createAuthRouter(authService: AuthService): Router {
  const router = Router();

  // POST /api/v1/auth/login
  router.post('/login', loginLimiter, validateBody(loginSchema), (req, res) => {
    const { email, password } = req.body;
    const token = authService.login(email, password);

    if (!token) {
      res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      return;
    }

    res.json({ token });
  });

  // GET /api/v1/auth/me
  router.get('/me', requireAdmin, (req, res) => {
    res.json({ user: req.user });
  });

  return router;
}
