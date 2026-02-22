import { describe, it, expect } from 'vitest';
import { Concours } from '../../domain/concours/entities/concours.js';
import { Equipe } from '../../domain/concours/entities/equipe.js';
import { Inscription } from '../../domain/concours/entities/inscription.js';
import { Terrain } from '../../domain/concours/entities/terrain.js';
import { StatutConcours, TypeEquipe, TypePhase, CritereClassement, TypeQualification } from '../../domain/shared/enums.js';
import { DateRange, FormuleConcours, ReglementConcours, PhaseDefinition, QualificationRule } from '../../domain/shared/value-objects.js';
import { InvalidStateTransitionError, InvariantViolationError } from '../../shared/types.js';

function creerFormuleTest(): FormuleConcours {
  const phase = new PhaseDefinition(
    TypePhase.POULES, 'integral',
    [CritereClassement.POINTS], [CritereClassement.GOAL_AVERAGE_GENERAL],
    new QualificationRule(TypeQualification.TOP_N_PER_POOL, 2),
  );
  return new FormuleConcours(TypeEquipe.TRIPLETTE, [phase], 4, 32);
}

function creerConcoursTest(id = 'c1'): Concours {
  return new Concours(
    id, 'Concours Test',
    new DateRange(new Date('2025-06-15'), new Date('2025-06-15')),
    'Boulodrome Municipal', 'org1',
    creerFormuleTest(), new ReglementConcours(),
  );
}

function creerEquipeTest(id: string, joueurIds: string[], clubId: string): Equipe {
  return new Equipe(id, joueurIds, clubId, `Equipe ${id}`);
}

function creerInscription(id: string, concoursId: string, equipe: Equipe): Inscription {
  return new Inscription(id, concoursId, equipe, new Date());
}

describe('Machine à états Concours', () => {
  it('démarre en BROUILLON', () => {
    const c = creerConcoursTest();
    expect(c.statut).toBe(StatutConcours.BROUILLON);
  });

  it('BROUILLON → INSCRIPTIONS_OUVERTES', () => {
    const c = creerConcoursTest();
    c.ouvrirInscriptions();
    expect(c.statut).toBe(StatutConcours.INSCRIPTIONS_OUVERTES);
  });

  it('INSCRIPTIONS_OUVERTES → INSCRIPTIONS_CLOSES', () => {
    const c = creerConcoursTest();
    c.ouvrirInscriptions();
    c.cloturerInscriptions();
    expect(c.statut).toBe(StatutConcours.INSCRIPTIONS_CLOSES);
  });

  it('INSCRIPTIONS_CLOSES → INSCRIPTIONS_OUVERTES (réouverture)', () => {
    const c = creerConcoursTest();
    c.ouvrirInscriptions();
    c.cloturerInscriptions();
    c.rouvrirInscriptions();
    expect(c.statut).toBe(StatutConcours.INSCRIPTIONS_OUVERTES);
  });

  it('INSCRIPTIONS_CLOSES → TIRAGE_EN_COURS (avec assez d\'équipes)', () => {
    const c = creerConcoursTest();
    c.ouvrirInscriptions();

    // Inscrire 4 équipes (minimum)
    for (let i = 0; i < 4; i++) {
      c.inscrireEquipe(creerInscription(
        `insc${i}`, 'c1',
        creerEquipeTest(`eq${i}`, [`j${i}a`, `j${i}b`, `j${i}c`], `club${i}`),
      ));
    }

    c.cloturerInscriptions();
    c.lancerTirage();
    expect(c.statut).toBe(StatutConcours.TIRAGE_EN_COURS);
  });

  it('refuse le tirage sans assez d\'équipes', () => {
    const c = creerConcoursTest();
    c.ouvrirInscriptions();
    c.cloturerInscriptions();
    expect(() => c.lancerTirage()).toThrow(InvariantViolationError);
  });

  it('TIRAGE_EN_COURS → EN_COURS', () => {
    const c = creerConcoursTest();
    c.ouvrirInscriptions();
    for (let i = 0; i < 4; i++) {
      c.inscrireEquipe(creerInscription(
        `insc${i}`, 'c1',
        creerEquipeTest(`eq${i}`, [`j${i}a`, `j${i}b`, `j${i}c`], `club${i}`),
      ));
    }
    c.cloturerInscriptions();
    c.lancerTirage();
    c.validerTirage();
    expect(c.statut).toBe(StatutConcours.EN_COURS);
  });

  it('TIRAGE_EN_COURS → INSCRIPTIONS_CLOSES (annulation tirage)', () => {
    const c = creerConcoursTest();
    c.ouvrirInscriptions();
    for (let i = 0; i < 4; i++) {
      c.inscrireEquipe(creerInscription(
        `insc${i}`, 'c1',
        creerEquipeTest(`eq${i}`, [`j${i}a`, `j${i}b`, `j${i}c`], `club${i}`),
      ));
    }
    c.cloturerInscriptions();
    c.lancerTirage();
    c.annulerTirage();
    expect(c.statut).toBe(StatutConcours.INSCRIPTIONS_CLOSES);
  });

  it('TERMINE → ARCHIVE', () => {
    const c = creerConcoursTest();
    c.ouvrirInscriptions();
    for (let i = 0; i < 4; i++) {
      c.inscrireEquipe(creerInscription(
        `insc${i}`, 'c1',
        creerEquipeTest(`eq${i}`, [`j${i}a`, `j${i}b`, `j${i}c`], `club${i}`),
      ));
    }
    c.cloturerInscriptions();
    c.lancerTirage();
    c.validerTirage();
    c.terminer();
    c.archiver();
    expect(c.statut).toBe(StatutConcours.ARCHIVE);
  });

  it('ARCHIVE est immuable — ne peut pas être annulé', () => {
    const c = creerConcoursTest();
    c.ouvrirInscriptions();
    for (let i = 0; i < 4; i++) {
      c.inscrireEquipe(creerInscription(
        `insc${i}`, 'c1',
        creerEquipeTest(`eq${i}`, [`j${i}a`, `j${i}b`, `j${i}c`], `club${i}`),
      ));
    }
    c.cloturerInscriptions();
    c.lancerTirage();
    c.validerTirage();
    c.terminer();
    c.archiver();
    expect(() => c.annuler()).toThrow(InvalidStateTransitionError);
  });

  it('annulation possible à tout moment sauf ARCHIVE', () => {
    const c = creerConcoursTest();
    c.annuler();
    expect(c.statut).toBe(StatutConcours.ANNULE);
  });

  it('refuse une transition invalide (BROUILLON → EN_COURS)', () => {
    const c = creerConcoursTest();
    expect(() => c.validerTirage()).toThrow(InvalidStateTransitionError);
  });
});

describe('Inscriptions', () => {
  it('refuse inscription si concours pas ouvert', () => {
    const c = creerConcoursTest();
    const eq = creerEquipeTest('eq1', ['j1', 'j2', 'j3'], 'club1');
    const insc = creerInscription('insc1', 'c1', eq);
    expect(() => c.inscrireEquipe(insc)).toThrow(InvariantViolationError);
  });

  it('refuse un joueur inscrit dans deux équipes', () => {
    const c = creerConcoursTest();
    c.ouvrirInscriptions();

    c.inscrireEquipe(creerInscription('insc1', 'c1', creerEquipeTest('eq1', ['j1', 'j2', 'j3'], 'club1')));
    // j1 est déjà inscrit
    expect(() =>
      c.inscrireEquipe(creerInscription('insc2', 'c1', creerEquipeTest('eq2', ['j1', 'j4', 'j5'], 'club2'))),
    ).toThrow(InvariantViolationError);
  });

  it('refuse une équipe avec mauvais nombre de joueurs', () => {
    const c = creerConcoursTest(); // formule = TRIPLETTE (3 joueurs)
    c.ouvrirInscriptions();
    const eq = creerEquipeTest('eq1', ['j1', 'j2'], 'club1'); // seulement 2 joueurs
    const insc = creerInscription('insc1', 'c1', eq);
    expect(() => c.inscrireEquipe(insc)).toThrow(InvariantViolationError);
  });

  it('annule une inscription', () => {
    const c = creerConcoursTest();
    c.ouvrirInscriptions();
    c.inscrireEquipe(creerInscription('insc1', 'c1', creerEquipeTest('eq1', ['j1', 'j2', 'j3'], 'club1')));
    expect(c.nbEquipesInscrites).toBe(1);
    c.annulerInscription('insc1');
    expect(c.nbEquipesInscrites).toBe(0);
  });
});

describe('Terrains', () => {
  it('ajoute un terrain', () => {
    const c = creerConcoursTest();
    c.ajouterTerrain(new Terrain('t1', 'c1', 1, 'Terrain 1'));
    expect(c.terrains).toHaveLength(1);
  });

  it('refuse un doublon de numéro de terrain', () => {
    const c = creerConcoursTest();
    c.ajouterTerrain(new Terrain('t1', 'c1', 1, 'Terrain 1'));
    expect(() => c.ajouterTerrain(new Terrain('t2', 'c1', 1, 'Terrain 1 bis'))).toThrow(InvariantViolationError);
  });
});
