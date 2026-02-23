import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error-handler.js';
import { createConcoursRouter } from './routes/concours.js';
import { createMatchsRouter } from './routes/matchs.js';
import { AppContext } from './context.js';

export function createApp(context: AppContext): express.Express {
  const app = express();

  // Middleware globaux
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Routes
  app.use('/api/v1/concours', createConcoursRouter(context));
  app.use('/api/v1/concours', createMatchsRouter(context));

  // Error handler (doit être dernier)
  app.use(errorHandler);

  return app;
}
