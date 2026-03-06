import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validation.js';
import { AuthService } from '../auth/auth-service.js';
import { requireAdmin } from '../auth/auth-middleware.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function createAuthRouter(authService: AuthService): Router {
  const router = Router();

  // POST /api/v1/auth/login
  router.post('/login', validateBody(loginSchema), (req, res) => {
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
