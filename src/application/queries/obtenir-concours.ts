import { EntityId, DomainError } from '../../shared/types.js';
import { ConcoursRepository } from '../../domain/concours/ports/concours-repository.js';
import { StatutConcours } from '../../domain/shared/enums.js';

export interface ConcoursDTO {
  id: EntityId;
  nom: string;
  dateDebut: Date;
  dateFin: Date;
  lieu: string;
  statut: StatutConcours;
  nbEquipesInscrites: number;
  nbTerrains: number;
  nbPhases: number;
}

export class ObtenirConcoursQuery {
  constructor(private concoursRepo: ConcoursRepository) {}

  async parId(id: EntityId): Promise<ConcoursDTO> {
    const concours = await this.concoursRepo.findById(id);
    if (!concours) throw new DomainError(`Concours ${id} non trouvé`);

    return {
      id: concours.id,
      nom: concours.nom,
      dateDebut: concours.dates.debut,
      dateFin: concours.dates.fin,
      lieu: concours.lieu,
      statut: concours.statut,
      nbEquipesInscrites: concours.nbEquipesInscrites,
      nbTerrains: concours.terrains.length,
      nbPhases: concours.phases.length,
    };
  }

  async tous(): Promise<ConcoursDTO[]> {
    const concours = await this.concoursRepo.findAll();
    return concours.map(c => ({
      id: c.id,
      nom: c.nom,
      dateDebut: c.dates.debut,
      dateFin: c.dates.fin,
      lieu: c.lieu,
      statut: c.statut,
      nbEquipesInscrites: c.nbEquipesInscrites,
      nbTerrains: c.terrains.length,
      nbPhases: c.phases.length,
    }));
  }

  async parStatut(statut: StatutConcours): Promise<ConcoursDTO[]> {
    const concours = await this.concoursRepo.findByStatut(statut);
    return concours.map(c => ({
      id: c.id,
      nom: c.nom,
      dateDebut: c.dates.debut,
      dateFin: c.dates.fin,
      lieu: c.lieu,
      statut: c.statut,
      nbEquipesInscrites: c.nbEquipesInscrites,
      nbTerrains: c.terrains.length,
      nbPhases: c.phases.length,
    }));
  }
}
