import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryConcoursRepository } from '../../infrastructure/repositories/in-memory-concours-repository.js';
import { InMemoryClubRepository } from '../../infrastructure/repositories/in-memory-club-repository.js';
import { InMemoryJoueurRepository } from '../../infrastructure/repositories/in-memory-joueur-repository.js';
import { Concours } from '../../domain/concours/entities/concours.js';
import { Club } from '../../domain/club/entities/club.js';
import { Joueur } from '../../domain/club/entities/joueur.js';
import { StatutConcours, TypeEquipe, TypePhase, CritereClassement } from '../../domain/shared/enums.js';
import { DateRange, FormuleConcours, ReglementConcours, PhaseDefinition, QualificationRule, LicenceNumber } from '../../domain/shared/value-objects.js';
import { TypeQualification } from '../../domain/shared/enums.js';

function makeConcours(id: string, statut?: StatutConcours): Concours {
  const dates = new DateRange(new Date('2026-06-01'), new Date('2026-06-01'));
  const formule = new FormuleConcours(
    TypeEquipe.TRIPLETTE,
    [new PhaseDefinition(TypePhase.POULES, 'integral', [CritereClassement.POINTS], [], new QualificationRule(TypeQualification.TOP_N, 2))],
    4,
    32,
  );
  return new Concours(id, 'Concours Test', dates, 'Boulodrome', 'org-1', formule, new ReglementConcours(), statut);
}

describe('InMemoryConcoursRepository', () => {
  let repo: InMemoryConcoursRepository;

  beforeEach(() => {
    repo = new InMemoryConcoursRepository();
  });

  it('save et findById', async () => {
    const concours = makeConcours('c-1');
    await repo.save(concours);

    const found = await repo.findById('c-1');
    expect(found).toBe(concours);
  });

  it('findById retourne null si inexistant', async () => {
    expect(await repo.findById('nope')).toBeNull();
  });

  it('findAll retourne tous les concours', async () => {
    await repo.save(makeConcours('c-1'));
    await repo.save(makeConcours('c-2'));

    const all = await repo.findAll();
    expect(all).toHaveLength(2);
  });

  it('findByStatut filtre correctement', async () => {
    await repo.save(makeConcours('c-1')); // BROUILLON par défaut
    const c2 = makeConcours('c-2');
    c2.ouvrirInscriptions();
    await repo.save(c2);

    const brouillons = await repo.findByStatut(StatutConcours.BROUILLON);
    expect(brouillons).toHaveLength(1);
    expect(brouillons[0].id).toBe('c-1');

    const ouverts = await repo.findByStatut(StatutConcours.INSCRIPTIONS_OUVERTES);
    expect(ouverts).toHaveLength(1);
    expect(ouverts[0].id).toBe('c-2');
  });

  it('findByOrganisateur filtre correctement', async () => {
    await repo.save(makeConcours('c-1')); // org-1
    const all = await repo.findByOrganisateur('org-1');
    expect(all).toHaveLength(1);

    const none = await repo.findByOrganisateur('org-99');
    expect(none).toHaveLength(0);
  });

  it('nextId génère des IDs uniques', () => {
    const id1 = repo.nextId();
    const id2 = repo.nextId();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^concours-/);
  });

  it('clear vide le store', async () => {
    await repo.save(makeConcours('c-1'));
    repo.clear();
    expect(await repo.findAll()).toHaveLength(0);
  });
});

describe('InMemoryClubRepository', () => {
  let repo: InMemoryClubRepository;

  beforeEach(() => {
    repo = new InMemoryClubRepository();
  });

  it('save et findById', async () => {
    const club = new Club('club-1', 'Boule Lyonnaise FC', '001', 'Lyon', 'D69', 'AURA');
    await repo.save(club);

    expect(await repo.findById('club-1')).toBe(club);
  });

  it('findAll', async () => {
    await repo.save(new Club('c1', 'A', '1', 'Lyon', 'D69', 'AURA'));
    await repo.save(new Club('c2', 'B', '2', 'Paris', 'D75', 'IDF'));

    expect(await repo.findAll()).toHaveLength(2);
  });

  it('nextId génère des IDs uniques', () => {
    expect(repo.nextId()).toMatch(/^club-/);
  });
});

describe('InMemoryJoueurRepository', () => {
  let repo: InMemoryJoueurRepository;

  beforeEach(() => {
    repo = new InMemoryJoueurRepository();
  });

  it('save et findById', async () => {
    const joueur = new Joueur('j-1', 'Dupont', 'Jean', null, 'club-1', 'Senior', null);
    await repo.save(joueur);

    expect(await repo.findById('j-1')).toBe(joueur);
  });

  it('findByClub filtre par club', async () => {
    await repo.save(new Joueur('j-1', 'A', 'A', null, 'club-1', 'Senior', null));
    await repo.save(new Joueur('j-2', 'B', 'B', null, 'club-1', 'Senior', null));
    await repo.save(new Joueur('j-3', 'C', 'C', null, 'club-2', 'Senior', null));

    const joueurs = await repo.findByClub('club-1');
    expect(joueurs).toHaveLength(2);
  });

  it('findByLicence trouve par numéro de licence', async () => {
    const licence = new LicenceNumber('LIC-001', 'A', '2025-2026');
    await repo.save(new Joueur('j-1', 'Dupont', 'Jean', licence, 'club-1', 'Senior', null));

    const found = await repo.findByLicence('LIC-001');
    expect(found).not.toBeNull();
    expect(found!.id).toBe('j-1');

    expect(await repo.findByLicence('NOPE')).toBeNull();
  });

  it('nextId génère des IDs uniques', () => {
    expect(repo.nextId()).toMatch(/^joueur-/);
  });
});
