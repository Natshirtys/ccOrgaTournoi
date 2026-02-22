import { EntityId, DomainError } from '../../shared/types.js';
import { ConcoursRepository } from '../../domain/concours/ports/concours-repository.js';
import { EventPublisher } from '../../domain/concours/ports/event-publisher.js';
import { Equipe } from '../../domain/concours/entities/equipe.js';
import { Inscription } from '../../domain/concours/entities/inscription.js';
import { StatutInscription } from '../../domain/shared/enums.js';
import { InscriptionAdded } from '../../domain/concours/events/concours-events.js';

export interface InscrireEquipeCommand {
  concoursId: EntityId;
  equipeId: EntityId;
  joueurIds: EntityId[];
  clubId: EntityId;
  nomEquipe: string;
  teteDeSerie?: boolean;
}

export class InscrireEquipeUseCase {
  constructor(
    private concoursRepo: ConcoursRepository,
    private eventPublisher: EventPublisher,
  ) {}

  async execute(cmd: InscrireEquipeCommand): Promise<EntityId> {
    const concours = await this.concoursRepo.findById(cmd.concoursId);
    if (!concours) {
      throw new DomainError(`Concours ${cmd.concoursId} non trouvé`);
    }

    const equipe = new Equipe(
      cmd.equipeId,
      cmd.joueurIds,
      cmd.clubId,
      cmd.nomEquipe,
    );

    const inscriptionId = `insc-${Date.now()}`;
    const inscription = new Inscription(
      inscriptionId,
      cmd.concoursId,
      equipe,
      new Date(),
      StatutInscription.CONFIRMEE,
      cmd.teteDeSerie ?? false,
    );

    concours.inscrireEquipe(inscription);
    await this.concoursRepo.save(concours);
    await this.eventPublisher.publish(
      new InscriptionAdded(cmd.concoursId, cmd.concoursId, inscriptionId, cmd.equipeId),
    );

    return inscriptionId;
  }
}
