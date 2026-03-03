import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

/**
 * Client Drizzle sur transport HTTP (pas TCP).
 * Adapté aux fonctions serverless Vercel : pas de connexion persistante.
 * DATABASE_URL doit être fourni via variable d'environnement.
 */
const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });
export type Db = typeof db;
