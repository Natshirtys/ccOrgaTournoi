import { ConcoursRepository } from '../domain/concours/ports/concours-repository.js';
import { ClubRepository, JoueurRepository } from '../domain/club/ports/club-repository.js';
import { EventPublisher } from '../domain/concours/ports/event-publisher.js';

/**
 * Contexte applicatif injecté dans les routes.
 * Contient les dépendances (ports) nécessaires aux controllers.
 */
export interface AppContext {
  concoursRepository: ConcoursRepository;
  clubRepository: ClubRepository;
  joueurRepository: JoueurRepository;
  eventPublisher: EventPublisher;
}
