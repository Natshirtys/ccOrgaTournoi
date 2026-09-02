import { pgTable, text, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';

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

export const joueursClubTable = pgTable('joueurs_club', {
  id:         text('id').primaryKey(),
  club_id:    text('club_id').notNull(),
  nom:        text('nom').notNull(),
  poste:      text('poste').notNull(),
  actif:      boolean('actif').notNull().default(true),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});
