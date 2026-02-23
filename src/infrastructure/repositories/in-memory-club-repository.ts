import { EntityId } from '../../shared/types.js';
import { Club } from '../../domain/club/entities/club.js';
import { ClubRepository } from '../../domain/club/ports/club-repository.js';

/**
 * Implémentation in-memory du repository Club.
 */
export class InMemoryClubRepository implements ClubRepository {
  private store = new Map<EntityId, Club>();
  private counter = 0;

  async findById(id: EntityId): Promise<Club | null> {
    return this.store.get(id) ?? null;
  }

  async save(club: Club): Promise<void> {
    this.store.set(club.id, club);
  }

  async findAll(): Promise<Club[]> {
    return Array.from(this.store.values());
  }

  nextId(): EntityId {
    this.counter++;
    return `club-${this.counter}`;
  }

  clear(): void {
    this.store.clear();
    this.counter = 0;
  }
}
