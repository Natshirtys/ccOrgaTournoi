import { eq } from 'drizzle-orm';
import { Concours } from '../../domain/concours/entities/concours.js';
import { StatutConcours } from '../../domain/shared/enums.js';
import { ConcoursRepository } from '../../domain/concours/ports/concours-repository.js';
import { EntityId } from '../../shared/types.js';
import { db } from '../db/client.js';
import { concoursTable } from '../db/schema.js';
import { serialize, deserialize } from '../db/concours-mapper.js';
import { ConcoursData } from '../db/types.js';

/**
 * Implémentation Drizzle/Neon du repository Concours.
 * Stockage JSONB : l'agrégat complet est sérialisé dans la colonne `data`.
 */
export class DrizzleConcoursRepository implements ConcoursRepository {
  async findById(id: EntityId): Promise<Concours | null> {
    const rows = await db.select().from(concoursTable).where(eq(concoursTable.id, id)).limit(1);
    if (rows.length === 0) return null;
    return deserialize(rows[0].data as ConcoursData);
  }

  async delete(id: EntityId): Promise<void> {
    await db.delete(concoursTable).where(eq(concoursTable.id, id));
  }

  async save(concours: Concours): Promise<void> {
    const data = serialize(concours);
    await db
      .insert(concoursTable)
      .values({
        id: concours.id,
        statut: concours.statut,
        organisateur_id: concours.organisateurId,
        data,
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: concoursTable.id,
        set: {
          statut: concours.statut,
          data,
          updated_at: new Date(),
        },
      });
  }

  async findByStatut(statut: StatutConcours): Promise<Concours[]> {
    const rows = await db.select().from(concoursTable).where(eq(concoursTable.statut, statut));
    return rows.map(r => deserialize(r.data as ConcoursData));
  }

  async findByOrganisateur(organisateurId: EntityId): Promise<Concours[]> {
    const rows = await db.select().from(concoursTable).where(eq(concoursTable.organisateur_id, organisateurId));
    return rows.map(r => deserialize(r.data as ConcoursData));
  }

  async findAll(): Promise<Concours[]> {
    const rows = await db.select().from(concoursTable);
    return rows.map(r => deserialize(r.data as ConcoursData));
  }

  nextId(): EntityId {
    return crypto.randomUUID();
  }
}
