import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

/**
 * Table unique : agrégat Concours complet sérialisé en JSONB.
 * Les colonnes statut et organisateur_id sont dénormalisées pour permettre
 * des filtres WHERE sans désérialiser le blob.
 */
export const concoursTable = pgTable('concours', {
  id:              text('id').primaryKey(),
  statut:          text('statut').notNull(),
  organisateur_id: text('organisateur_id').notNull(),
  data:            jsonb('data').notNull(),
  updated_at:      timestamp('updated_at').notNull().defaultNow(),
});
