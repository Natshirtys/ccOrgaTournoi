import { EntityId } from '../../../shared/types.js';
import { Concours } from '../entities/concours.js';
import { StatutConcours } from '../../shared/enums.js';

export interface ConcoursRepository {
  findById(id: EntityId): Promise<Concours | null>;
  save(concours: Concours): Promise<void>;
  delete(id: EntityId): Promise<void>;
  findByStatut(statut: StatutConcours): Promise<Concours[]>;
  findByOrganisateur(organisateurId: EntityId): Promise<Concours[]>;
  findAll(): Promise<Concours[]>;
  nextId(): EntityId;
}
