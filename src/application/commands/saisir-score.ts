import { EntityId, DomainError } from '../../shared/types.js';
import { ConcoursRepository } from '../../domain/concours/ports/concours-repository.js';
import { EventPublisher } from '../../domain/concours/ports/event-publisher.js';
import { Score, ResultatMatch } from '../../domain/shared/value-objects.js';
import { TypeResultat } from '../../domain/shared/enums.js';
import { ScoreSaisi } from '../../domain/concours/events/concours-events.js';

export interface SaisirScoreCommand {
  concoursId: EntityId;
  phaseId: EntityId;
  tourId: EntityId;
  matchId: EntityId;
  pointsA: number;
  pointsB: number;
}

export class SaisirScoreUseCase {
  constructor(
    private concoursRepo: ConcoursRepository,
    private eventPublisher: EventPublisher,
  ) {}

  async execute(cmd: SaisirScoreCommand): Promise<void> {
    const concours = await this.concoursRepo.findById(cmd.concoursId);
    if (!concours) {
      throw new DomainError(`Concours ${cmd.concoursId} non trouvé`);
    }

    const phase = concours.phases.find(p => p.id === cmd.phaseId);
    if (!phase) throw new DomainError(`Phase ${cmd.phaseId} non trouvée`);

    const tour = phase.trouverTour(cmd.tourId);
    if (!tour) throw new DomainError(`Tour ${cmd.tourId} non trouvé`);

    const match = tour.trouverMatch(cmd.matchId);
    if (!match) throw new DomainError(`Match ${cmd.matchId} non trouvé`);

    const score = new Score(cmd.pointsA, cmd.pointsB);
    match.saisirScore(score);

    // Déterminer le résultat
    let resultat: ResultatMatch;
    if (cmd.pointsA > cmd.pointsB) {
      resultat = new ResultatMatch(
        match.equipeAId, TypeResultat.VICTOIRE, score,
        concours.reglement.pointsVictoire, concours.reglement.pointsDefaite,
      );
    } else if (cmd.pointsB > cmd.pointsA) {
      resultat = new ResultatMatch(
        match.equipeBId!, TypeResultat.VICTOIRE, score,
        concours.reglement.pointsDefaite, concours.reglement.pointsVictoire,
      );
    } else {
      if (!concours.reglement.nulAutorise) {
        throw new DomainError('Le match nul n\'est pas autorisé dans ce concours');
      }
      resultat = ResultatMatch.nul(score, concours.reglement.pointsNul);
    }

    match.validerResultat(resultat);
    await this.concoursRepo.save(concours);
    await this.eventPublisher.publish(
      new ScoreSaisi(cmd.concoursId, cmd.concoursId, cmd.matchId, cmd.pointsA, cmd.pointsB),
    );
  }
}
