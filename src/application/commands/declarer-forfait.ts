import { EntityId, DomainError } from '../../shared/types.js';
import { ConcoursRepository } from '../../domain/concours/ports/concours-repository.js';
import { EventPublisher } from '../../domain/concours/ports/event-publisher.js';
import { ResultatMatch } from '../../domain/shared/value-objects.js';
import { ForfaitDeclare } from '../../domain/concours/events/concours-events.js';

export interface DeclarerForfaitCommand {
  concoursId: EntityId;
  phaseId: EntityId;
  tourId: EntityId;
  matchId: EntityId;
  equipeId: EntityId;
}

export class DeclarerForfaitUseCase {
  constructor(
    private concoursRepo: ConcoursRepository,
    private eventPublisher: EventPublisher,
  ) {}

  async execute(cmd: DeclarerForfaitCommand): Promise<void> {
    const concours = await this.concoursRepo.findById(cmd.concoursId);
    if (!concours) throw new DomainError(`Concours ${cmd.concoursId} non trouvé`);

    const phase = concours.phases.find(p => p.id === cmd.phaseId);
    if (!phase) throw new DomainError(`Phase ${cmd.phaseId} non trouvée`);

    const tour = phase.trouverTour(cmd.tourId);
    if (!tour) throw new DomainError(`Tour ${cmd.tourId} non trouvé`);

    const match = tour.trouverMatch(cmd.matchId);
    if (!match) throw new DomainError(`Match ${cmd.matchId} non trouvé`);

    match.declarerForfait(cmd.equipeId);

    const vainqueurId = cmd.equipeId === match.equipeAId ? match.equipeBId! : match.equipeAId;
    const resultat = ResultatMatch.forfait(
      vainqueurId,
      concours.reglement.scoreForfaitGagnant,
      concours.reglement.scoreForfaitPerdant,
      concours.reglement.pointsVictoire,
      concours.reglement.pointsDefaite,
    );

    // Le forfait met directement le résultat (pas besoin de saisir score puis valider)
    match['_resultat'] = resultat;

    await this.concoursRepo.save(concours);
    await this.eventPublisher.publish(
      new ForfaitDeclare(cmd.concoursId, cmd.concoursId, cmd.matchId, cmd.equipeId),
    );
  }
}
