import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error-handler.js';
import { createConcoursRouter } from './routes/concours.js';
import { createMatchsRouter } from './routes/matchs.js';
import { createAuthRouter } from './routes/auth.js';
import { createAuthenticateMiddleware } from './auth/auth-middleware.js';
import { AppContext } from './context.js';

export function createApp(context: AppContext): express.Express {
  const app = express();

  // Middleware globaux
  app.set('trust proxy', 1); // Nécessaire pour le rate limiting derrière Vercel/reverse proxy
  app.use(cors({
    origin: process.env.ALLOWED_ORIGIN ?? true, // true = mirror Origin en dev, restreindre via ALLOWED_ORIGIN en prod
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  }));
  app.use(express.json({ limit: '10kb' }));

  // Parse JWT silencieusement (no-op si authService absent)
  app.use(createAuthenticateMiddleware(context.authService ?? null));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Routes auth (seulement si authService disponible)
  if (context.authService) {
    app.use('/api/v1/auth', createAuthRouter(context.authService));
  }

  // Routes
  app.use('/api/v1/concours', createConcoursRouter(context));
  app.use('/api/v1/concours', createMatchsRouter(context));

  // Error handler (doit être dernier)
  app.use(errorHandler);

  return app;
}
