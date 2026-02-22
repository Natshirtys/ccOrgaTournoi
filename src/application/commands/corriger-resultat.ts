import { EntityId, DomainError } from '../../shared/types.js';
import { ConcoursRepository } from '../../domain/concours/ports/concours-repository.js';
import { EventPublisher } from '../../domain/concours/ports/event-publisher.js';
import { Score, ResultatMatch } from '../../domain/shared/value-objects.js';
import { TypeResultat } from '../../domain/shared/enums.js';
import { ScoreCorrige } from '../../domain/concours/events/concours-events.js';

export interface CorrigerResultatCommand {
  concoursId: EntityId;
  phaseId: EntityId;
  tourId: EntityId;
  matchId: EntityId;
  nouveauPointsA: number;
  nouveauPointsB: number;
  raison: string;
}

export class CorrigerResultatUseCase {
  constructor(
    private concoursRepo: ConcoursRepository,
    private eventPublisher: EventPublisher,
  ) {}

  async execute(cmd: CorrigerResultatCommand): Promise<void> {
    const concours = await this.concoursRepo.findById(cmd.concoursId);
    if (!concours) throw new DomainError(`Concours ${cmd.concoursId} non trouvé`);

    const phase = concours.phases.find(p => p.id === cmd.phaseId);
    if (!phase) throw new DomainError(`Phase ${cmd.phaseId} non trouvée`);

    const tour = phase.trouverTour(cmd.tourId);
    if (!tour) throw new DomainError(`Tour ${cmd.tourId} non trouvé`);

    const match = tour.trouverMatch(cmd.matchId);
    if (!match) throw new DomainError(`Match ${cmd.matchId} non trouvé`);

    const ancienScore = match.score;
    if (!ancienScore) throw new DomainError('Le match n\'a pas de score à corriger');

    match.demanderCorrection();

    const nouveauScore = new Score(cmd.nouveauPointsA, cmd.nouveauPointsB);
    let nouveauResultat: ResultatMatch;

    if (cmd.nouveauPointsA > cmd.nouveauPointsB) {
      nouveauResultat = new ResultatMatch(
        match.equipeAId, TypeResultat.VICTOIRE, nouveauScore,
        concours.reglement.pointsVictoire, concours.reglement.pointsDefaite,
      );
    } else if (cmd.nouveauPointsB > cmd.nouveauPointsA) {
      nouveauResultat = new ResultatMatch(
        match.equipeBId!, TypeResultat.VICTOIRE, nouveauScore,
        concours.reglement.pointsDefaite, concours.reglement.pointsVictoire,
      );
    } else {
      if (!concours.reglement.nulAutorise) {
        throw new DomainError('Le match nul n\'est pas autorisé');
      }
      nouveauResultat = ResultatMatch.nul(nouveauScore, concours.reglement.pointsNul);
    }

    match.corrigerScore(nouveauScore, nouveauResultat);
    await this.concoursRepo.save(concours);
    await this.eventPublisher.publish(
      new ScoreCorrige(
        cmd.concoursId, cmd.concoursId, cmd.matchId,
        { pointsA: ancienScore.pointsA, pointsB: ancienScore.pointsB },
        { pointsA: cmd.nouveauPointsA, pointsB: cmd.nouveauPointsB },
      ),
    );
  }
}
