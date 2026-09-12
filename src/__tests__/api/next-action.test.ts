import { describe, expect, it } from 'vitest';
import { obtenirProchaineAction } from '../../api/helpers/next-action.js';
import { Concours } from '../../domain/concours/entities/concours.js';
import { Equipe } from '../../domain/concours/entities/equipe.js';
import { Inscription } from '../../domain/concours/entities/inscription.js';
import { Match } from '../../domain/concours/entities/match.js';
import { Phase } from '../../domain/concours/entities/phase.js';
import { Tour } from '../../domain/concours/entities/tour.js';
import {
  CritereClassement,
  StatutConcours,
  StatutMatch,
  StatutPhase,
  StatutTour,
  TypeEquipe,
  TypePhase,
} from '../../domain/shared/enums.js';
import {
  DateRange,
  FormuleConcours,
  PhaseDefinition,
  ReglementConcours,
} from '../../domain/shared/value-objects.js';

function creerConcours(
  statut: StatutConcours,
  nbInscriptions = 0,
  phase?: Phase,
  typeEquipe = TypeEquipe.DOUBLETTE,
): Concours {
  const phaseDefinition = new PhaseDefinition(
    TypePhase.ELIMINATION_SIMPLE,
    'integral',
    [CritereClassement.POINTS],
    [],
    null,
  );
  const inscriptions = Array.from({ length: nbInscriptions }, (_, index) => {
    const equipe = new Equipe(`equipe-${index}`, [], '', `Equipe ${index + 1}`);
    return new Inscription(`inscription-${index}`, 'concours-1', equipe, new Date());
  });

  return new Concours(
    'concours-1',
    'Concours Test',
    new DateRange(new Date('2026-09-01'), new Date('2026-09-01')),
    'Lyon',
    'org-1',
    new FormuleConcours(typeEquipe, [phaseDefinition], 4, 16),
    new ReglementConcours(),
    statut,
    [],
    phase ? [phase] : [],
    inscriptions,
  );
}

function creerPhase(statutMatch: StatutMatch, statutPhase = StatutPhase.EN_COURS): Phase {
  const definition = new PhaseDefinition(
    TypePhase.ELIMINATION_SIMPLE,
    'integral',
    [CritereClassement.POINTS],
    [],
    null,
  );
  const match = new Match(
    'match-1',
    'tour-1',
    'equipe-1',
    'equipe-2',
    null,
    null,
    statutMatch,
  );
  const tour = new Tour('tour-1', 'phase-1', 1, StatutTour.EN_COURS, [match]);
  return new Phase(
    'phase-1',
    'concours-1',
    TypePhase.ELIMINATION_SIMPLE,
    1,
    definition,
    'Phase finale',
    statutPhase,
    [tour],
  );
}

describe('obtenirProchaineAction', () => {
  it('propose d’ouvrir les inscriptions pour un brouillon', () => {
    expect(obtenirProchaineAction(creerConcours(StatutConcours.BROUILLON)).code)
      .toBe('OUVRIR_INSCRIPTIONS');
  });

  it('indique le nombre d’équipes manquantes', () => {
    const action = obtenirProchaineAction(
      creerConcours(StatutConcours.INSCRIPTIONS_OUVERTES, 2),
    );

    expect(action.code).toBe('COMPLETER_INSCRIPTIONS');
    expect(action.titre).toContain('2 équipes');
    expect(action.progression).toEqual({
      valeur: 2,
      total: 4,
      libelle: '2 sur 4 équipes minimum',
    });
  });

  it('parle de joueurs pour un concours en tête-à-tête', () => {
    const action = obtenirProchaineAction(
      creerConcours(StatutConcours.INSCRIPTIONS_OUVERTES, 2, undefined, TypeEquipe.TETE_A_TETE),
    );

    expect(action.titre).toContain('2 joueurs');
    expect(action.progression?.libelle).toBe('2 sur 4 joueurs minimum');
  });

  it('propose de clôturer quand le minimum est atteint', () => {
    expect(obtenirProchaineAction(
      creerConcours(StatutConcours.INSCRIPTIONS_OUVERTES, 4),
    ).code).toBe('CLOTURER_INSCRIPTIONS');
  });

  it('propose le tirage après la clôture', () => {
    expect(obtenirProchaineAction(
      creerConcours(StatutConcours.INSCRIPTIONS_CLOSES, 4),
    ).code).toBe('LANCER_TIRAGE');
  });

  it('compte les résultats restant à saisir', () => {
    const action = obtenirProchaineAction(
      creerConcours(StatutConcours.EN_COURS, 4, creerPhase(StatutMatch.PROGRAMME)),
    );

    expect(action.code).toBe('JOUER_MATCHS');
    expect(action.progression?.valeur).toBe(0);
    expect(action.progression?.total).toBe(1);
  });

  it('propose de générer la suite quand le tour est joué', () => {
    expect(obtenirProchaineAction(
      creerConcours(StatutConcours.EN_COURS, 4, creerPhase(StatutMatch.TERMINE)),
    ).code).toBe('GENERER_SUITE');
  });

  it('propose de terminer quand toutes les phases sont closes', () => {
    const phase = creerPhase(StatutMatch.TERMINE, StatutPhase.TERMINEE);
    expect(obtenirProchaineAction(
      creerConcours(StatutConcours.EN_COURS, 4, phase),
    ).code).toBe('TERMINER_CONCOURS');
  });
});
