import type { Express } from 'express';
import { buildContext } from './bootstrap.js';
import { createApp } from './server.js';

/**
 * Entry point Vercel (serverless).
 * Vercel ne supporte pas app.listen() — on exporte l'app Express comme handler.
 *
 * Le singleton appPromise est réutilisé entre les invocations chaudes (warm starts)
 * pour éviter de recréer le contexte à chaque requête.
 */
let appPromise: Promise<Express> | null = null;

export default async function handler(req: any, res: any): Promise<void> {
  if (!appPromise) {
    appPromise = buildContext().then(ctx => createApp(ctx));
  }
  const app = await appPromise;
  app(req, res);
}
