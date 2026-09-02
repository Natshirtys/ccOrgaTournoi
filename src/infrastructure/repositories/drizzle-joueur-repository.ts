import { eq, sql } from 'drizzle-orm';
import { Joueur } from '../../domain/club/entities/joueur.js';
import { JoueurRepository } from '../../domain/club/ports/club-repository.js';
import { PosteMelee } from '../../domain/shared/enums.js';
import { EntityId } from '../../shared/types.js';
import { db } from '../db/client.js';
import { joueursClubTable } from '../db/schema.js';

let tableReady: Promise<void> | null = null;

function ensureTable(): Promise<void> {
  tableReady ??= db.execute(sql`
    CREATE TABLE IF NOT EXISTS joueurs_club (
      id text PRIMARY KEY,
      club_id text NOT NULL,
      nom text NOT NULL,
      poste text NOT NULL,
      actif boolean NOT NULL DEFAULT true,
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `).then(() => undefined);
  return tableReady;
}

function toDomain(row: typeof joueursClubTable.$inferSelect): Joueur {
  return new Joueur(
    row.id,
    row.nom,
    '',
    null,
    row.club_id,
    '',
    null,
    row.actif,
    row.poste as PosteMelee,
  );
}

export class DrizzleJoueurRepository implements JoueurRepository {
  async findById(id: EntityId): Promise<Joueur | null> {
    await ensureTable();
    const rows = await db.select().from(joueursClubTable).where(eq(joueursClubTable.id, id)).limit(1);
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async findByClub(clubId: EntityId): Promise<Joueur[]> {
    await ensureTable();
    const rows = await db.select().from(joueursClubTable).where(eq(joueursClubTable.club_id, clubId));
    return rows.map(toDomain);
  }

  async findByLicence(): Promise<Joueur | null> {
    return null;
  }

  async save(joueur: Joueur): Promise<void> {
    await ensureTable();
    await db.insert(joueursClubTable).values({
      id: joueur.id,
      club_id: joueur.clubId,
      nom: joueur.nomComplet,
      poste: joueur.poste,
      actif: joueur.actif,
      updated_at: new Date(),
    }).onConflictDoUpdate({
      target: joueursClubTable.id,
      set: {
        nom: joueur.nomComplet,
        poste: joueur.poste,
        actif: joueur.actif,
        updated_at: new Date(),
      },
    });
  }

  async delete(id: EntityId): Promise<void> {
    await ensureTable();
    await db.delete(joueursClubTable).where(eq(joueursClubTable.id, id));
  }

  nextId(): EntityId {
    return crypto.randomUUID();
  }
}
