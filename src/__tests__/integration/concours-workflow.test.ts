import { describe, it, expect, beforeEach } from 'vitest';

// Infrastructure
import { InMemoryConcoursRepository } from '../../infrastructure/repositories/in-memory-concours-repository.js';
import { InMemoryEventBus } from '../../infrastructure/events/in-memory-event-bus.js';

// Domain
import { Concours } from '../../domain/concours/entities/concours.js';
import { Equipe } from '../../domain/concours/entities/equipe.js';
import { Inscription } from '../../domain/concours/entities/inscription.js';
import { Terrain } from '../../domain/concours/entities/terrain.js';
import { Phase } from '../../domain/concours/entities/phase.js';
import { Tour } from '../../domain/concours/entities/tour.js';
import { Match } from '../../domain/concours/entities/match.js';
import { Classement, LigneClassement } from '../../domain/concours/entities/classement.js';
import { StatutConcours, StatutMatch, TypeEquipe, TypePhase, CritereClassement, TypeQualification } from '../../domain/shared/enums.js';
import { DateRange, FormuleConcours, ReglementConcours, PhaseDefinition, QualificationRule, Score, ResultatMatch, GoalAverage } from '../../domain/shared/value-objects.js';

// Engine
import { PoolPhaseStrategy } from '../../engine/strategies/phase/pool-phase-strategy.js';
import { PointsRankingStrategy } from '../../engine/strategies/ranking/points-ranking-strategy.js';
import { RankingEntry } from '../../engine/strategies/interfaces.js';

/**
 * Test d'intégration bout en bout :
 * Créer un concours → Inscrire 4 équipes → Phase de poules → Jouer les matchs → Classement
 */
describe('Workflow complet : concours de poules triplettes', () => {
  let repo: InMemoryConcoursRepository;
  let eventBus: InMemoryEventBus;

  beforeEach(() => {
    repo = new InMemoryConcoursRepository();
    eventBus = new InMemoryEventBus();
  });

  it('scénario complet : création → inscription → poules → scores → classement', async () => {
    // ─── 1. Créer le concours ───
    const concoursId = repo.nextId();
    const formule = new FormuleConcours(
      TypeEquipe.TRIPLETTE,
      [new PhaseDefinition(
        TypePhase.POULES,
        'integral',
        [CritereClassement.POINTS, CritereClassement.GOAL_AVERAGE_GENERAL],
        [CritereClassement.POINTS_MARQUES],
        new QualificationRule(TypeQualification.TOP_N, 2),
      )],
      4,
      16,
    );
    const reglement = new ReglementConcours({ pointsVictoire: 2, pointsNul: 1, pointsDefaite: 0 });
    const dates = new DateRange(new Date('2026-06-15'), new Date('2026-06-15'));

    const concours = new Concours(
      concoursId, 'Concours du Boulodrome', dates, 'Boulodrome Municipal',
      'org-1', formule, reglement,
    );

    await repo.save(concours);

    // ─── 2. Ajouter des terrains ───
    concours.ajouterTerrain(new Terrain('t-1', concoursId, 1, 'Terrain A'));
    concours.ajouterTerrain(new Terrain('t-2', concoursId, 2, 'Terrain B'));

    expect(concours.terrains).toHaveLength(2);

    // ─── 3. Ouvrir les inscriptions et inscrire 4 triplettes ───
    concours.ouvrirInscriptions();
    expect(concours.statut).toBe(StatutConcours.INSCRIPTIONS_OUVERTES);

    const equipes = [
      new Equipe('eq-1', ['j-1', 'j-2', 'j-3'], 'club-1', 'Les Lions'),
      new Equipe('eq-2', ['j-4', 'j-5', 'j-6'], 'club-2', 'Les Aigles'),
      new Equipe('eq-3', ['j-7', 'j-8', 'j-9'], 'club-3', 'Les Faucons'),
      new Equipe('eq-4', ['j-10', 'j-11', 'j-12'], 'club-4', 'Les Ours'),
    ];

    equipes.forEach((eq, i) => {
      concours.inscrireEquipe(new Inscription(`insc-${i + 1}`, concoursId, eq, new Date()));
    });

    expect(concours.nbEquipesInscrites).toBe(4);

    // ─── 4. Clôturer inscriptions et lancer le tirage ───
    concours.cloturerInscriptions();
    expect(concours.statut).toBe(StatutConcours.INSCRIPTIONS_CLOSES);

    concours.lancerTirage();
    expect(concours.statut).toBe(StatutConcours.TIRAGE_EN_COURS);

    // ─── 5. Générer la phase de poules avec le moteur ───
    const phaseConfig = new PhaseDefinition(
      TypePhase.POULES, 'integral',
      [CritereClassement.POINTS, CritereClassement.GOAL_AVERAGE_GENERAL],
      [CritereClassement.POINTS_MARQUES],
      new QualificationRule(TypeQualification.TOP_N, 2),
    );

    const phase = new Phase('phase-1', concoursId, TypePhase.POULES, 1, phaseConfig);
    concours.ajouterPhase(phase);

    const poolStrategy = new PoolPhaseStrategy();
    const equipeIds = equipes.map((e) => e.id);
    const phaseContext = {
      phaseId: 'phase-1',
      equipeIds,
      matchResults: [] as { matchId: string; equipeAId: string; equipeBId: string | null; scoreA: number; scoreB: number; vainqueurId: string | null }[],
      config: { nbPoules: 1 },
    };
    const tours = poolStrategy.generateTours(phaseContext);

    expect(tours).toHaveLength(1); // Seul le tour 1 est généré

    // ─── 6. Valider le tirage et démarrer ───
    concours.validerTirage();
    expect(concours.statut).toBe(StatutConcours.EN_COURS);
    phase.demarrer();

    // ─── 7. Créer et jouer les matchs tour par tour (3 tours avec progression) ───
    const allMatchResults: { equipeAId: string; equipeBId: string; scoreA: number; scoreB: number; vainqueurId: string }[] = [];

    // Scores prédéfinis pour un scénario réaliste
    const scores = [
      // Tour 1 : A-B, C-D
      [{ a: 13, b: 8 }, { a: 5, b: 13 }],
      // Tour 2 : gagnants vs gagnants, perdants vs perdants
      [{ a: 13, b: 11 }, { a: 13, b: 7 }],
      // Tour 3 : barrage
      [{ a: 10, b: 13 }],
    ];

    // Tour 1
    const allTourGens = [tours[0]];

    function playTour(tourGen: typeof tours[0], tourIdx: number) {
      const tour = new Tour(`tour-${tourIdx + 1}`, 'phase-1', tourGen.numero);

      for (let matchIdx = 0; matchIdx < tourGen.matchups.length; matchIdx++) {
        const mu = tourGen.matchups[matchIdx];
        const matchId = `match-${tourIdx + 1}-${matchIdx + 1}`;
        const match = new Match(matchId, tour.id, mu.equipeAId, mu.equipeBId);
        tour.ajouterMatch(match);
      }

      phase.ajouterTour(tour);
      tour.demarrer();

      for (let matchIdx = 0; matchIdx < tour.matchs.length; matchIdx++) {
        const match = tour.matchs[matchIdx] as Match;
        if (match.isBye) continue;

        const s = scores[tourIdx][matchIdx];
        match.demarrer();
        match.saisirScore(new Score(s.a, s.b));

        const vainqueurId = s.a > s.b ? match.equipeAId : match.equipeBId!;
        match.validerResultat(ResultatMatch.victoire(
          vainqueurId,
          new Score(s.a, s.b),
          reglement.pointsVictoire,
          reglement.pointsDefaite,
        ));

        expect(match.statut).toBe(StatutMatch.TERMINE);

        allMatchResults.push({
          equipeAId: match.equipeAId,
          equipeBId: match.equipeBId!,
          scoreA: s.a,
          scoreB: s.b,
          vainqueurId,
        });

        phaseContext.matchResults.push({
          matchId: match.id,
          equipeAId: match.equipeAId,
          equipeBId: match.equipeBId,
          scoreA: s.a,
          scoreB: s.b,
          vainqueurId,
        });
      }

      tour.terminer();
    }

    // Jouer tour 1
    playTour(allTourGens[0], 0);

    // Générer et jouer tour 2
    const tour2Gen = poolStrategy.generateNextTour(phaseContext, 1);
    expect(tour2Gen).not.toBeNull();
    playTour(tour2Gen!, 1);

    // Générer et jouer tour 3 (barrage)
    const tour3Gen = poolStrategy.generateNextTour(phaseContext, 2);
    expect(tour3Gen).not.toBeNull();
    playTour(tour3Gen!, 2);

    expect(phase.tours).toHaveLength(3);

    // ─── 8. Calculer le classement ───
    const rankingEntries: RankingEntry[] = equipeIds.map((eqId) => {
      const matchesForEquipe = allMatchResults.filter(
        (r) => r.equipeAId === eqId || r.equipeBId === eqId,
      );

      let points = 0, victoires = 0, defaites = 0, ptsMar = 0, ptsEnc = 0;

      for (const r of matchesForEquipe) {
        const isA = r.equipeAId === eqId;
        ptsMar += isA ? r.scoreA : r.scoreB;
        ptsEnc += isA ? r.scoreB : r.scoreA;
        if (r.vainqueurId === eqId) {
          victoires++;
          points += reglement.pointsVictoire;
        } else {
          defaites++;
          points += reglement.pointsDefaite;
        }
      }

      return {
        equipeId: eqId,
        matchesJoues: matchesForEquipe.length,
        victoires,
        nuls: 0,
        defaites,
        pointsMarques: ptsMar,
        pointsEncaisses: ptsEnc,
        points,
      };
    });

    const rankingStrategy = new PointsRankingStrategy(2);
    const ranked = rankingStrategy.calculate(rankingEntries);

    // Vérifications du classement
    expect(ranked).toHaveLength(4);
    expect(ranked[0].rang).toBe(1);
    expect(ranked[3].rang).toBe(4);

    // Les 2 premiers sont qualifiés
    expect(ranked[0].qualifiee).toBe(true);
    expect(ranked[1].qualifiee).toBe(true);
    expect(ranked[2].qualifiee).toBe(false);
    expect(ranked[3].qualifiee).toBe(false);

    // Construire le classement domain
    const lignes: LigneClassement[] = ranked.map((r) => ({
      equipeId: r.equipeId,
      rang: r.rang,
      points: r.points,
      matchsJoues: r.matchesJoues,
      matchsGagnes: r.victoires,
      matchsPerdus: r.defaites,
      matchsNuls: r.nuls,
      pointsMarques: r.pointsMarques,
      pointsEncaisses: r.pointsEncaisses,
      goalAverage: new GoalAverage(r.pointsMarques, r.pointsEncaisses),
      qualifiee: r.qualifiee,
    }));

    const classement = new Classement('phase-1', lignes, [
      CritereClassement.POINTS,
      CritereClassement.GOAL_AVERAGE_GENERAL,
    ]);

    phase.mettreAJourClassement(classement);
    expect(phase.classement).not.toBeNull();
    expect(phase.classement!.getQualifiees()).toHaveLength(2);

    // ─── 9. Terminer la phase et le concours ───
    phase.terminer();
    concours.terminer();
    expect(concours.statut).toBe(StatutConcours.TERMINE);

    // ─── 10. Sauvegarder et vérifier la persistance ───
    await repo.save(concours);
    const retrieved = await repo.findById(concoursId);
    expect(retrieved).toBe(concours);
    expect(retrieved!.statut).toBe(StatutConcours.TERMINE);
    expect(retrieved!.phases[0].classement!.lignes).toHaveLength(4);

    // ─── 11. Vérifier les événements (optionnel avec l'event bus) ───
    await eventBus.publish({
      eventType: 'ConcoursTermine',
      occurredOn: new Date(),
      aggregateId: concoursId,
    });
    expect(eventBus.getPublishedEvents()).toHaveLength(1);
  });

  it('refuse l\'inscription si concours pas ouvert', async () => {
    const formule = new FormuleConcours(
      TypeEquipe.TRIPLETTE,
      [new PhaseDefinition(TypePhase.POULES, 'integral', [CritereClassement.POINTS], [], new QualificationRule(TypeQualification.TOP_N, 2))],
      4, 16,
    );
    const concours = new Concours(
      'c-test', 'Test', new DateRange(new Date('2026-06-01'), new Date('2026-06-01')),
      'Lieu', 'org-1', formule, new ReglementConcours(),
    );

    const equipe = new Equipe('eq-1', ['j-1', 'j-2', 'j-3'], 'club-1', 'Test');
    const inscription = new Inscription('insc-1', 'c-test', equipe, new Date());

    // Concours en BROUILLON → inscription impossible
    expect(() => concours.inscrireEquipe(inscription)).toThrow('inscriptions ne sont pas ouvertes');
  });

  it('refuse le tirage si pas assez d\'équipes', async () => {
    const formule = new FormuleConcours(
      TypeEquipe.TRIPLETTE,
      [new PhaseDefinition(TypePhase.POULES, 'integral', [CritereClassement.POINTS], [], new QualificationRule(TypeQualification.TOP_N, 2))],
      4, 16,
    );
    const concours = new Concours(
      'c-test', 'Test', new DateRange(new Date('2026-06-01'), new Date('2026-06-01')),
      'Lieu', 'org-1', formule, new ReglementConcours(),
    );

    concours.ouvrirInscriptions();
    // Inscrire seulement 2 équipes (minimum = 4)
    concours.inscrireEquipe(new Inscription('i1', 'c-test', new Equipe('eq-1', ['j-1', 'j-2', 'j-3'], 'club-1', 'A'), new Date()));
    concours.inscrireEquipe(new Inscription('i2', 'c-test', new Equipe('eq-2', ['j-4', 'j-5', 'j-6'], 'club-2', 'B'), new Date()));

    concours.cloturerInscriptions();
    expect(() => concours.lancerTirage()).toThrow('Pas assez');
  });
});
