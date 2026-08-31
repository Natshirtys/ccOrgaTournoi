import { describe, expect, it } from 'vitest';
import { assignerTerrainsAuTour } from '../../api/helpers/terrain-assignment.js';
import { Concours } from '../../domain/concours/entities/concours.js';
import { Match } from '../../domain/concours/entities/match.js';
import { Terrain } from '../../domain/concours/entities/terrain.js';
import { Tour } from '../../domain/concours/entities/tour.js';
import { CritereClassement, TypeEquipe, TypePhase } from '../../domain/shared/enums.js';
import { DateRange, FormuleConcours, PhaseDefinition, ReglementConcours } from '../../domain/shared/value-objects.js';

function creerConcoursAvecTerrains(): Concours {
  const definition = new PhaseDefinition(
    TypePhase.MELEE_TOURNANTE,
    'integral',
    [CritereClassement.NOMBRE_VICTOIRES],
    [],
    null,
    { nbParties: 3 },
  );
  const concours = new Concours(
    'concours-1',
    'Mêlée',
    new DateRange(new Date('2026-09-01'), new Date('2026-09-01')),
    'Lyon',
    'organisateur',
    new FormuleConcours(TypeEquipe.DOUBLETTE, [definition], 2, 32),
    new ReglementConcours(),
  );
  concours.ajouterTerrain(new Terrain('terrain-1', concours.id, 1, 'Terrain 1'));
  const indisponible = new Terrain('terrain-2', concours.id, 2, 'Terrain 2');
  concours.ajouterTerrain(indisponible);
  concours.definirDisponibiliteTerrain(indisponible.id, false);
  return concours;
}

describe('assignerTerrainsAuTour', () => {
  it('ignore les terrains mis hors service lors de la génération d’un nouveau tour', () => {
    const concours = creerConcoursAvecTerrains();
    const tour = new Tour('tour-2', 'phase-1', 2);
    tour.ajouterMatch(new Match('match-1', tour.id, 'equipe-1', 'equipe-2'));
    tour.ajouterMatch(new Match('match-2', tour.id, 'equipe-3', 'equipe-4'));

    assignerTerrainsAuTour(concours, tour);

    expect(tour.matchs[0].terrainId).toBe('terrain-1');
    expect(tour.matchs[1].terrainId).toBeNull();
    expect(tour.matchs.every((match) => match.terrainId !== 'terrain-2')).toBe(true);
  });
});
