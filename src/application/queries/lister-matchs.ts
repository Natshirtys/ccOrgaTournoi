import { EntityId, DomainError } from '../../shared/types.js';
import { ConcoursRepository } from '../../domain/concours/ports/concours-repository.js';
import { StatutMatch } from '../../domain/shared/enums.js';

export interface MatchDTO {
  id: EntityId;
  tourId: EntityId;
  equipeAId: EntityId;
  equipeBId: EntityId | null;
  terrainId: EntityId | null;
  horaire: Date | null;
  statut: StatutMatch;
  scoreA: number | null;
  scoreB: number | null;
  vainqueurId: string | null;
}

export class ListerMatchsQuery {
  constructor(private concoursRepo: ConcoursRepository) {}

  async parPhase(concoursId: EntityId, phaseId: EntityId): Promise<MatchDTO[]> {
    const concours = await this.concoursRepo.findById(concoursId);
    if (!concours) throw new DomainError(`Concours ${concoursId} non trouvé`);

    const phase = concours.phases.find(p => p.id === phaseId);
    if (!phase) throw new DomainError(`Phase ${phaseId} non trouvée`);

    const matchs: MatchDTO[] = [];
    for (const tour of phase.tours) {
      for (const match of tour.matchs) {
        matchs.push({
          id: match.id,
          tourId: match.tourId,
          equipeAId: match.equipeAId,
          equipeBId: match.equipeBId,
          terrainId: match.terrainId,
          horaire: match.horaire,
          statut: match.statut,
          scoreA: match.score?.pointsA ?? null,
          scoreB: match.score?.pointsB ?? null,
          vainqueurId: match.resultat?.vainqueur ?? null,
        });
      }
    }
    return matchs;
  }

  async parTour(concoursId: EntityId, phaseId: EntityId, tourId: EntityId): Promise<MatchDTO[]> {
    const concours = await this.concoursRepo.findById(concoursId);
    if (!concours) throw new DomainError(`Concours ${concoursId} non trouvé`);

    const phase = concours.phases.find(p => p.id === phaseId);
    if (!phase) throw new DomainError(`Phase ${phaseId} non trouvée`);

    const tour = phase.trouverTour(tourId);
    if (!tour) throw new DomainError(`Tour ${tourId} non trouvé`);

    return tour.matchs.map(match => ({
      id: match.id,
      tourId: match.tourId,
      equipeAId: match.equipeAId,
      equipeBId: match.equipeBId,
      terrainId: match.terrainId,
      horaire: match.horaire,
      statut: match.statut,
      scoreA: match.score?.pointsA ?? null,
      scoreB: match.score?.pointsB ?? null,
      vainqueurId: match.resultat?.vainqueur ?? null,
    }));
  }
}
