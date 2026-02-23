import { EntityId } from '../../shared/types.js';
import { Joueur } from '../../domain/club/entities/joueur.js';
import { JoueurRepository } from '../../domain/club/ports/club-repository.js';

/**
 * Implémentation in-memory du repository Joueur.
 */
export class InMemoryJoueurRepository implements JoueurRepository {
  private store = new Map<EntityId, Joueur>();
  private counter = 0;

  async findById(id: EntityId): Promise<Joueur | null> {
    return this.store.get(id) ?? null;
  }

  async findByClub(clubId: EntityId): Promise<Joueur[]> {
    return Array.from(this.store.values()).filter((j) => j.clubId === clubId);
  }

  async findByLicence(numero: string): Promise<Joueur | null> {
    return Array.from(this.store.values()).find(
      (j) => j.licence?.numero === numero,
    ) ?? null;
  }

  async save(joueur: Joueur): Promise<void> {
    this.store.set(joueur.id, joueur);
  }

  nextId(): EntityId {
    this.counter++;
    return `joueur-${this.counter}`;
  }

  clear(): void {
    this.store.clear();
    this.counter = 0;
  }
}
