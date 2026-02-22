import { EntityId, DomainError } from '../../shared/types.js';
import { ConcoursRepository } from '../../domain/concours/ports/concours-repository.js';
import { CritereClassement } from '../../domain/shared/enums.js';

export interface ClassementDTO {
  phaseId: EntityId;
  criteres: CritereClassement[];
  lignes: LigneClassementDTO[];
}

export interface LigneClassementDTO {
  equipeId: EntityId;
  rang: number;
  points: number;
  matchsJoues: number;
  matchsGagnes: number;
  matchsPerdus: number;
  matchsNuls: number;
  pointsMarques: number;
  pointsEncaisses: number;
  goalAverageDifference: number;
  qualifiee: boolean;
}

export class ObtenirClassementQuery {
  constructor(private concoursRepo: ConcoursRepository) {}

  async execute(concoursId: EntityId, phaseId: EntityId): Promise<ClassementDTO> {
    const concours = await this.concoursRepo.findById(concoursId);
    if (!concours) throw new DomainError(`Concours ${concoursId} non trouvé`);

    const phase = concours.phases.find(p => p.id === phaseId);
    if (!phase) throw new DomainError(`Phase ${phaseId} non trouvée`);

    const classement = phase.classement;
    if (!classement) throw new DomainError(`Pas de classement pour la phase ${phaseId}`);

    return {
      phaseId: classement.phaseId,
      criteres: classement.criteres,
      lignes: classement.lignes.map(l => ({
        equipeId: l.equipeId,
        rang: l.rang,
        points: l.points,
        matchsJoues: l.matchsJoues,
        matchsGagnes: l.matchsGagnes,
        matchsPerdus: l.matchsPerdus,
        matchsNuls: l.matchsNuls,
        pointsMarques: l.pointsMarques,
        pointsEncaisses: l.pointsEncaisses,
        goalAverageDifference: l.goalAverage.difference,
        qualifiee: l.qualifiee,
      })),
    };
  }
}
