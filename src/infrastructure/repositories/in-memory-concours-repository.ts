import { EntityId } from '../../shared/types.js';
import { Concours } from '../../domain/concours/entities/concours.js';
import { StatutConcours } from '../../domain/shared/enums.js';
import { ConcoursRepository } from '../../domain/concours/ports/concours-repository.js';

/**
 * Implémentation in-memory du repository Concours.
 * Stockage dans une Map, pas de persistance.
 */
export class InMemoryConcoursRepository implements ConcoursRepository {
  private store = new Map<EntityId, Concours>();
  private counter = 0;

  async findById(id: EntityId): Promise<Concours | null> {
    return this.store.get(id) ?? null;
  }

  async save(concours: Concours): Promise<void> {
    this.store.set(concours.id, concours);
  }

  async findByStatut(statut: StatutConcours): Promise<Concours[]> {
    return Array.from(this.store.values()).filter((c) => c.statut === statut);
  }

  async findByOrganisateur(organisateurId: EntityId): Promise<Concours[]> {
    return Array.from(this.store.values()).filter((c) => c.organisateurId === organisateurId);
  }

  async findAll(): Promise<Concours[]> {
    return Array.from(this.store.values());
  }

  nextId(): EntityId {
    this.counter++;
    return `concours-${this.counter}`;
  }

  /**
   * Remet à zéro le store (utile pour les tests).
   */
  clear(): void {
    this.store.clear();
    this.counter = 0;
  }
}
