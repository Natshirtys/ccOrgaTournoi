import { EntityId } from '../../shared/types.js';
import { Concours } from '../../domain/concours/entities/concours.js';
import { ConcoursRepository } from '../../domain/concours/ports/concours-repository.js';
import { EventPublisher } from '../../domain/concours/ports/event-publisher.js';
import { DateRange, FormuleConcours, ReglementConcours } from '../../domain/shared/value-objects.js';
import { ConcoursCreated } from '../../domain/concours/events/concours-events.js';

export interface CreerConcoursCommand {
  nom: string;
  dateDebut: Date;
  dateFin: Date;
  lieu: string;
  organisateurId: EntityId;
  formule: FormuleConcours;
  reglement?: ReglementConcours;
}

export class CreerConcoursUseCase {
  constructor(
    private concoursRepo: ConcoursRepository,
    private eventPublisher: EventPublisher,
  ) {}

  async execute(cmd: CreerConcoursCommand): Promise<EntityId> {
    const id = this.concoursRepo.nextId();
    const dates = new DateRange(cmd.dateDebut, cmd.dateFin);
    const reglement = cmd.reglement ?? new ReglementConcours();

    const concours = new Concours(
      id,
      cmd.nom,
      dates,
      cmd.lieu,
      cmd.organisateurId,
      cmd.formule,
      reglement,
    );

    await this.concoursRepo.save(concours);
    await this.eventPublisher.publish(new ConcoursCreated(id, id, cmd.nom));

    return id;
  }
}
