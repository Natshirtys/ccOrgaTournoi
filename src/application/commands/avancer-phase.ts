import { EntityId, DomainError } from '../../shared/types.js';
import { ConcoursRepository } from '../../domain/concours/ports/concours-repository.js';
import { EventPublisher } from '../../domain/concours/ports/event-publisher.js';
import { PhaseStarted, PhaseCompleted } from '../../domain/concours/events/concours-events.js';

export interface AvancerPhaseCommand {
  concoursId: EntityId;
  phaseId: EntityId;
  action: 'DEMARRER' | 'TERMINER';
}

export class AvancerPhaseUseCase {
  constructor(
    private concoursRepo: ConcoursRepository,
    private eventPublisher: EventPublisher,
  ) {}

  async execute(cmd: AvancerPhaseCommand): Promise<void> {
    const concours = await this.concoursRepo.findById(cmd.concoursId);
    if (!concours) throw new DomainError(`Concours ${cmd.concoursId} non trouvé`);

    const phase = concours.phases.find(p => p.id === cmd.phaseId);
    if (!phase) throw new DomainError(`Phase ${cmd.phaseId} non trouvée`);

    if (cmd.action === 'DEMARRER') {
      phase.demarrer();
      await this.concoursRepo.save(concours);
      await this.eventPublisher.publish(
        new PhaseStarted(cmd.concoursId, cmd.concoursId, cmd.phaseId, phase.type),
      );
    } else {
      phase.terminer();
      await this.concoursRepo.save(concours);
      await this.eventPublisher.publish(
        new PhaseCompleted(cmd.concoursId, cmd.concoursId, cmd.phaseId),
      );
    }
  }
}
