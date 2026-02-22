import { CompositeSpecification, EntityId } from '../../../shared/types.js';
import { Concours } from '../entities/concours.js';
import { Equipe } from '../entities/equipe.js';


export class NombreEquipesMinimumSpec extends CompositeSpecification<Concours> {
  isSatisfiedBy(concours: Concours): boolean {
    return concours.nbEquipesInscrites >= concours.formule.nbEquipesMin;
  }
}

export class NombreEquipesMaximumSpec extends CompositeSpecification<Concours> {
  isSatisfiedBy(concours: Concours): boolean {
    return concours.nbEquipesInscrites <= concours.formule.nbEquipesMax;
  }
}

export class EquipeCompleteSpec extends CompositeSpecification<{ equipe: Equipe; concours: Concours }> {
  isSatisfiedBy(candidate: { equipe: Equipe; concours: Concours }): boolean {
    try {
      candidate.equipe.validateComposition(candidate.concours.formule.typeEquipe);
      return true;
    } catch {
      return false;
    }
  }
}

export class PasDeDoublonJoueurSpec extends CompositeSpecification<{ equipe: Equipe; concours: Concours }> {
  isSatisfiedBy(candidate: { equipe: Equipe; concours: Concours }): boolean {
    const joueursInscrits = new Set<EntityId>();
    for (const insc of candidate.concours.inscriptionsActives) {
      for (const jId of insc.equipe.joueurIds) {
        joueursInscrits.add(jId);
      }
    }
    return !candidate.equipe.joueurIds.some(jId => joueursInscrits.has(jId));
  }
}

export class ProtectionClubRespecteSpec extends CompositeSpecification<{ assignments: Map<EntityId, number>; clubByEquipe: Map<EntityId, EntityId> }> {
  isSatisfiedBy(candidate: { assignments: Map<EntityId, number>; clubByEquipe: Map<EntityId, EntityId> }): boolean {
    const groupes = new Map<number, EntityId[]>();
    for (const [equipeId, groupe] of candidate.assignments) {
      if (!groupes.has(groupe)) groupes.set(groupe, []);
      groupes.get(groupe)!.push(equipeId);
    }
    for (const equipes of groupes.values()) {
      const clubs = equipes.map(e => candidate.clubByEquipe.get(e));
      const uniqueClubs = new Set(clubs.filter(c => c !== undefined));
      if (uniqueClubs.size < clubs.filter(c => c !== undefined).length) {
        return false;
      }
    }
    return true;
  }
}

export class TerrainDisponibleSpec extends CompositeSpecification<{ terrainId: EntityId; concours: Concours }> {
  isSatisfiedBy(candidate: { terrainId: EntityId; concours: Concours }): boolean {
    const terrain = candidate.concours.terrains.find(t => t.id === candidate.terrainId);
    return terrain !== undefined && terrain.disponible;
  }
}
