import { describe, expect, it } from 'vitest';
import { assignerTerrainsAuTour } from '../../api/helpers/terrain-assignment.js';
import { Concours } from '../../domain/concours/entities/concours.js';
import { Match } from '../../domain/concours/entities/match.js';
import { Phase } from '../../domain/concours/entities/phase.js';
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

  it('évite pour chaque joueur le terrain utilisé lors de la partie précédente', () => {
    const concours = creerConcoursAvecTerrains();
    concours.definirDisponibiliteTerrain('terrain-2', true);
    const definition = concours.formule.phases[0];
    const phase = new Phase('phase-1', concours.id, TypePhase.MELEE_TOURNANTE, 1, definition);
    concours.ajouterPhase(phase);

    const premierTour = new Tour('tour-1', phase.id, 1);
    const ancienMatch = new Match(
      'match-ancien', premierTour.id, 'ancienne-a', 'ancienne-b', 'terrain-1', null,
      undefined, null, null, ['p1', 'p2'], ['p3', 'p4'],
    );
    premierTour.ajouterMatch(ancienMatch);
    phase.ajouterTour(premierTour);

    const nouveauTour = new Tour('tour-2', phase.id, 2);
    const nouveauMatch = new Match(
      'match-nouveau', nouveauTour.id, 'nouvelle-a', 'nouvelle-b', null, null,
      undefined, null, null, ['p1', 'p3'], ['p5', 'p6'],
    );
    nouveauTour.ajouterMatch(nouveauMatch);
    phase.ajouterTour(nouveauTour);

    assignerTerrainsAuTour(concours, nouveauTour);

    expect(nouveauMatch.terrainId).toBe('terrain-2');
  });
});
