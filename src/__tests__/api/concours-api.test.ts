import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../../api/server.js';
import { InMemoryConcoursRepository } from '../../infrastructure/repositories/in-memory-concours-repository.js';
import { InMemoryClubRepository } from '../../infrastructure/repositories/in-memory-club-repository.js';
import { InMemoryJoueurRepository } from '../../infrastructure/repositories/in-memory-joueur-repository.js';
import { InMemoryEventBus } from '../../infrastructure/events/in-memory-event-bus.js';
import { AppContext } from '../../api/context.js';
import express from 'express';

// Helper pour faire des requêtes sans supertest (on utilise l'app directement)
async function request(app: express.Express, method: string, path: string, body?: unknown) {
  return new Promise<{ status: number; body: Record<string, unknown> }>((resolve) => {
    const server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      const url = `http://localhost:${port}${path}`;

      fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      })
        .then(async (res) => {
          const text = await res.text();
          const json = text ? JSON.parse(text) as Record<string, unknown> : {};
          server.close();
          resolve({ status: res.status, body: json });
        })
        .catch((err) => {
          server.close();
          throw err;
        });
    });
  });
}

describe('API Concours', () => {
  let app: express.Express;
  let ctx: AppContext;

  beforeEach(() => {
    ctx = {
      concoursRepository: new InMemoryConcoursRepository(),
      clubRepository: new InMemoryClubRepository(),
      joueurRepository: new InMemoryJoueurRepository(),
      eventPublisher: new InMemoryEventBus(),
    };
    app = createApp(ctx);
  });

  it('GET /api/health retourne ok', async () => {
    const res = await request(app, 'GET', '/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/v1/concours retourne une liste vide', async () => {
    const res = await request(app, 'GET', '/api/v1/concours');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('POST /api/v1/concours crée un concours', async () => {
    const res = await request(app, 'POST', '/api/v1/concours', {
      nom: 'Concours Test',
      dateDebut: '2026-06-15',
      dateFin: '2026-06-15',
      lieu: 'Boulodrome Municipal',
      organisateurId: 'org-1',
      typeEquipe: 'TRIPLETTE',
    });

    expect(res.status).toBe(201);
    expect(res.body.nom).toBe('Concours Test');
    expect(res.body.statut).toBe('BROUILLON');
    expect(res.body.id).toBeDefined();

    const detailRes = await request(
      app,
      'GET',
      `/api/v1/concours/${res.body.id as string}`,
    );
    expect((detailRes.body.prochaineAction as Record<string, unknown>).code)
      .toBe('OUVRIR_INSCRIPTIONS');
  });

  it('POST validation échoue avec des données invalides', async () => {
    const res = await request(app, 'POST', '/api/v1/concours', {
      nom: '', // vide
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation échouée');
  });

  it('workflow complet via API : créer → inscrire → tirer → score → classement', async () => {
    // 1. Créer
    const createRes = await request(app, 'POST', '/api/v1/concours', {
      nom: 'Tournoi API',
      dateDebut: '2026-07-01',
      dateFin: '2026-07-01',
      lieu: 'Lyon',
      organisateurId: 'org-1',
      typeEquipe: 'TRIPLETTE',
      nbEquipesMin: 4,
      nbEquipesMax: 16,
    });
    expect(createRes.status).toBe(201);
    const concoursId = createRes.body.id as string;

    // 2. Ajouter un terrain
    const terrainRes = await request(app, 'POST', `/api/v1/concours/${concoursId}/terrains`, {
      numero: 1,
      nom: 'Terrain A',
    });
    expect(terrainRes.status).toBe(201);

    // 3. Ouvrir inscriptions
    const ouvrirRes = await request(app, 'POST', `/api/v1/concours/${concoursId}/ouvrir-inscriptions`);
    expect(ouvrirRes.status).toBe(200);
    expect(ouvrirRes.body.statut).toBe('INSCRIPTIONS_OUVERTES');

    // 4. Inscrire 4 triplettes (nouveaux noms de champs)
    for (let i = 1; i <= 4; i++) {
      const inscRes = await request(app, 'POST', `/api/v1/concours/${concoursId}/inscriptions`, {
        nomEquipe: `Equipe ${i}`,
        joueurs: [`j-${i}a`, `j-${i}b`, `j-${i}c`],
        club: `club-${i}`,
      });
      expect(inscRes.status).toBe(201);
    }

    // 5. Clôturer
    const cloturerRes = await request(app, 'POST', `/api/v1/concours/${concoursId}/cloturer-inscriptions`);
    expect(cloturerRes.status).toBe(200);

    // 6. Tirage (ne génère que le Tour 1 en mode progression dynamique)
    const tirageRes = await request(app, 'POST', `/api/v1/concours/${concoursId}/tirage`, {
      nbPoules: 1,
    });
    expect(tirageRes.status).toBe(201);
    expect(tirageRes.body.statut).toBe('EN_COURS');
    expect(tirageRes.body.nbTours).toBe(1); // Tour 1 seulement (progression dynamique)

    // 7. Lister les matchs du Tour 1
    const matchsRes = await request(app, 'GET', `/api/v1/concours/${concoursId}/matchs`);
    expect(matchsRes.status).toBe(200);
    const matchs = matchsRes.body.data as Array<{ id: string; equipeAId: string; equipeBId: string | null; statut: string }>;
    expect(matchs.length).toBe(2); // 4 équipes en 1 poule, Tour 1 = 2 matchs (A-B, C-D)

    // 8. Jouer les matchs du Tour 1 (démarrer + saisir score)
    for (const match of matchs) {
      if (!match.equipeBId) continue; // skip BYE

      await request(app, 'POST', `/api/v1/concours/${concoursId}/matchs/${match.id}/demarrer`);

      await request(app, 'POST', `/api/v1/concours/${concoursId}/matchs/${match.id}/score`, {
        scoreEquipeA: 13,
        scoreEquipeB: 8,
      });
    }

    // 9. Classement après Tour 1
    const classementRes = await request(app, 'GET', `/api/v1/concours/${concoursId}/classement`);
    expect(classementRes.status).toBe(200);
    const classement = classementRes.body.classement as Array<{ rang: number; equipeId: string; points: number }>;
    expect(classement).toHaveLength(4);
    expect(classement[0].rang).toBe(1);
    expect(classement[0].points).toBeGreaterThan(0);
  });

  it('permet de modifier puis annuler une inscription ouverte', async () => {
    const createRes = await request(app, 'POST', '/api/v1/concours', {
      nom: 'Gestion inscriptions',
      dateDebut: '2026-07-01',
      typeEquipe: 'DOUBLETTE',
    });
    const concoursId = createRes.body.id as string;
    await request(app, 'POST', `/api/v1/concours/${concoursId}/ouvrir-inscriptions`);

    const inscriptionRes = await request(app, 'POST', `/api/v1/concours/${concoursId}/inscriptions`, {
      nomEquipe: 'Equipe initiale',
      joueurs: ['Alice', 'Bob'],
      club: 'IBM',
    });
    expect(inscriptionRes.status).toBe(201);
    const inscriptionId = inscriptionRes.body.inscriptionId as string;

    const modificationRes = await request(
      app,
      'PATCH',
      `/api/v1/concours/${concoursId}/inscriptions/${inscriptionId}`,
      {
        nomEquipe: 'Equipe corrigée',
        joueurs: ['Alice', 'Charlie'],
        club: 'IBM',
        teteDeSerie: true,
      },
    );
    expect(modificationRes.status).toBe(200);

    const detailRes = await request(app, 'GET', `/api/v1/concours/${concoursId}`);
    const inscriptions = detailRes.body.inscriptions as Array<Record<string, unknown>>;
    expect(inscriptions[0]).toMatchObject({
      id: inscriptionId,
      nomEquipe: 'Equipe corrigée',
      joueurs: ['Alice', 'Charlie'],
      teteDeSerie: true,
    });

    const annulationRes = await request(
      app,
      'DELETE',
      `/api/v1/concours/${concoursId}/inscriptions/${inscriptionId}`,
    );
    expect(annulationRes.status).toBe(204);

    const detailApresAnnulation = await request(app, 'GET', `/api/v1/concours/${concoursId}`);
    expect(detailApresAnnulation.body.inscriptions).toEqual([]);
  });

  it("refuse les doublons de nom d'équipe et les compositions incorrectes", async () => {
    const createRes = await request(app, 'POST', '/api/v1/concours', {
      nom: 'Validations inscriptions',
      dateDebut: '2026-07-01',
      typeEquipe: 'DOUBLETTE',
    });
    const concoursId = createRes.body.id as string;
    await request(app, 'POST', `/api/v1/concours/${concoursId}/ouvrir-inscriptions`);

    const first = await request(app, 'POST', `/api/v1/concours/${concoursId}/inscriptions`, {
      nomEquipe: 'Les Bleus',
    });
    expect(first.status).toBe(201);

    const duplicate = await request(app, 'POST', `/api/v1/concours/${concoursId}/inscriptions`, {
      nomEquipe: '  les bleus ',
    });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.error).toMatch(/déjà inscrite/i);

    const badComposition = await request(app, 'POST', `/api/v1/concours/${concoursId}/inscriptions`, {
      nomEquipe: 'Les Rouges',
      joueurs: ['Alice'],
    });
    expect(badComposition.status).toBe(400);
    expect(badComposition.body.error).toMatch(/exactement 2 joueur/i);
  });

  it('rejette le tirage si le nombre d\'équipes n\'est pas multiple de 4 (poules)', async () => {
    const createRes = await request(app, 'POST', '/api/v1/concours', {
      nom: 'Tournoi 5eq',
      dateDebut: '2026-07-01',
      dateFin: '2026-07-01',
      lieu: 'Lyon',
      organisateurId: 'org-1',
      typeEquipe: 'TRIPLETTE',
      nbEquipesMin: 2,
      nbEquipesMax: 16,
    });
    const concoursId = createRes.body.id as string;

    await request(app, 'POST', `/api/v1/concours/${concoursId}/ouvrir-inscriptions`);

    // Inscrire 5 équipes (pas multiple de 4)
    for (let i = 1; i <= 5; i++) {
      await request(app, 'POST', `/api/v1/concours/${concoursId}/inscriptions`, {
        nomEquipe: `Equipe ${i}`,
      });
    }

    await request(app, 'POST', `/api/v1/concours/${concoursId}/cloturer-inscriptions`);

    const tirageRes = await request(app, 'POST', `/api/v1/concours/${concoursId}/tirage`, {});
    expect(tirageRes.status).toBe(400);
    expect(tirageRes.body.error).toMatch(/multiple de 4/);
  });

  it('workflow complet 8 équipes (2 poules GSL + phase KO avec croisement)', async () => {
    // 1. Créer
    const createRes = await request(app, 'POST', '/api/v1/concours', {
      nom: 'Tournoi 8eq',
      dateDebut: '2026-07-01',
      dateFin: '2026-07-01',
      lieu: 'Lyon',
      organisateurId: 'org-1',
      typeEquipe: 'TRIPLETTE',
      nbEquipesMin: 4,
      nbEquipesMax: 16,
    });
    const concoursId = createRes.body.id as string;

    // 2. Ouvrir inscriptions + inscrire 8 équipes
    await request(app, 'POST', `/api/v1/concours/${concoursId}/ouvrir-inscriptions`);
    for (let i = 1; i <= 8; i++) {
      const inscRes = await request(app, 'POST', `/api/v1/concours/${concoursId}/inscriptions`, {
        nomEquipe: `Equipe ${i}`,
      });
      expect(inscRes.status).toBe(201);
    }
    await request(app, 'POST', `/api/v1/concours/${concoursId}/cloturer-inscriptions`);

    // 3. Tirage — 2 poules de 4
    const tirageRes = await request(app, 'POST', `/api/v1/concours/${concoursId}/tirage`, {
      nbPoules: 2,
    });
    expect(tirageRes.status).toBe(201);
    expect(tirageRes.body.nbTours).toBe(1); // Tour 1 seulement

    // Helper pour jouer tous les matchs d'un tour
    async function playAllMatches(cid: string) {
      const matchsRes = await request(app, 'GET', `/api/v1/concours/${cid}/matchs`);
      const allMatchs = matchsRes.body.data as Array<{
        id: string; equipeAId: string; equipeBId: string | null; statut: string;
      }>;
      const pending = allMatchs.filter((m) => m.statut === 'PROGRAMME' || m.statut === 'EN_COURS');
      for (const m of pending) {
        if (!m.equipeBId) continue;
        if (m.statut === 'PROGRAMME') {
          await request(app, 'POST', `/api/v1/concours/${cid}/matchs/${m.id}/demarrer`);
        }
        await request(app, 'POST', `/api/v1/concours/${cid}/matchs/${m.id}/score`, {
          scoreEquipeA: 13,
          scoreEquipeB: 8,
        });
      }
    }

    // 4. Jouer Tour 1 des poules
    await playAllMatches(concoursId);

    // 5. Générer Tour 2
    const tour2Res = await request(app, 'POST', `/api/v1/concours/${concoursId}/generer-tour-suivant`);
    expect(tour2Res.status).toBe(201);
    expect((tour2Res.body.tour as Record<string, unknown>)?.numero).toBe(2);

    // 6. Jouer Tour 2
    await playAllMatches(concoursId);

    // 7. Générer Tour 3 (barrage)
    const tour3Res = await request(app, 'POST', `/api/v1/concours/${concoursId}/generer-tour-suivant`);
    expect(tour3Res.status).toBe(201);
    expect((tour3Res.body.tour as Record<string, unknown>)?.numero).toBe(3);

    // 8. Jouer Tour 3
    await playAllMatches(concoursId);

    // 9. Générer phase KO — doit créer la phase éliminatoire avec croisement
    const koRes = await request(app, 'POST', `/api/v1/concours/${concoursId}/generer-tour-suivant`);
    expect(koRes.status).toBe(201);
    expect(koRes.body.phaseType).toBe('ELIMINATION_SIMPLE');
    expect(koRes.body.qualifies).toBeDefined();

    const koMatchups = koRes.body.tours as Array<{ matchups: Array<{ equipeA: string; equipeB: string }> }>;
    expect(koMatchups).toHaveLength(1);
    // 2 poules → 2 demi-finales (croisement 1A vs 2B, 1B vs 2A)
    expect(koMatchups[0].matchups).toHaveLength(2);

    // 10. Jouer les demi-finales
    await playAllMatches(concoursId);

    // 11. Générer la finale
    const finaleRes = await request(app, 'POST', `/api/v1/concours/${concoursId}/generer-tour-suivant`);
    expect(finaleRes.status).toBe(201);

    // 12. Jouer la finale
    await playAllMatches(concoursId);

    // 13. Vérifier que la phase est terminée
    const endRes = await request(app, 'POST', `/api/v1/concours/${concoursId}/generer-tour-suivant`);
    expect(endRes.body.message).toMatch(/terminée/i);
  });

  it('DELETE /api/v1/concours/:id supprime un concours en BROUILLON', async () => {
    const createRes = await request(app, 'POST', '/api/v1/concours', {
      nom: 'À supprimer',
      dateDebut: '2026-08-01',
      organisateurId: 'org-1',
      typeEquipe: 'DOUBLETTE',
    });
    expect(createRes.status).toBe(201);
    const id = createRes.body.id as string;

    const delRes = await request(app, 'DELETE', `/api/v1/concours/${id}`);
    expect(delRes.status).toBe(204);

    const getRes = await request(app, 'GET', `/api/v1/concours/${id}`);
    expect(getRes.status).toBe(404);
  });

  it('DELETE /api/v1/concours/:id retourne 404 si inexistant', async () => {
    const res = await request(app, 'DELETE', '/api/v1/concours/inexistant');
    expect(res.status).toBe(404);
  });

  it('DELETE /api/v1/concours/:id retourne 409 si statut EN_COURS', async () => {
    // Créer un concours avec 4 équipes et lancer le tirage → statut EN_COURS
    const createRes = await request(app, 'POST', '/api/v1/concours', {
      nom: 'En cours non supprimable',
      dateDebut: '2026-08-01',
      organisateurId: 'org-1',
      typeEquipe: 'DOUBLETTE',
      nbEquipesMin: 4,
    });
    const id = createRes.body.id as string;

    await request(app, 'POST', `/api/v1/concours/${id}/ouvrir-inscriptions`);
    for (let i = 1; i <= 4; i++) {
      await request(app, 'POST', `/api/v1/concours/${id}/inscriptions`, { nomEquipe: `Equipe ${i}` });
    }
    await request(app, 'POST', `/api/v1/concours/${id}/cloturer-inscriptions`);
    const tirageRes = await request(app, 'POST', `/api/v1/concours/${id}/tirage`, { nbPoules: 1 });
    expect(tirageRes.status).toBe(201);
    expect(tirageRes.body.statut).toBe('EN_COURS');

    // Tenter de supprimer un concours EN_COURS
    const delRes = await request(app, 'DELETE', `/api/v1/concours/${id}`);
    expect(delRes.status).toBe(409);
  });

  it('POST /:id/archiver retourne 409 si statut ≠ TERMINE', async () => {
    const createRes = await request(app, 'POST', '/api/v1/concours', {
      nom: 'Brouillon non archivable',
      dateDebut: '2026-09-01',
      organisateurId: 'org-1',
      typeEquipe: 'TETE_A_TETE',
    });
    const id = createRes.body.id as string;

    const archRes = await request(app, 'POST', `/api/v1/concours/${id}/archiver`);
    expect(archRes.status).toBe(409);
  });

  it('PATCH permet de mettre un terrain hors service puis de le réactiver', async () => {
    const createRes = await request(app, 'POST', '/api/v1/concours', {
      nom: 'Terrains réglables',
      dateDebut: '2026-09-01',
      organisateurId: 'org-1',
      typeEquipe: 'DOUBLETTE',
      nbTerrains: 1,
    });
    const id = createRes.body.id as string;

    const disableRes = await request(
      app,
      'PATCH',
      `/api/v1/concours/${id}/terrains/terrain-1/disponibilite`,
      { actif: false },
    );
    expect(disableRes.status).toBe(200);
    expect(disableRes.body.actif).toBe(false);
    expect(disableRes.body.disponible).toBe(false);

    const enableRes = await request(
      app,
      'PATCH',
      `/api/v1/concours/${id}/terrains/terrain-1/disponibilite`,
      { actif: true },
    );
    expect(enableRes.status).toBe(200);
    expect(enableRes.body.actif).toBe(true);
    expect(enableRes.body.disponible).toBe(true);
  });

  it('exporte puis réimporte une sauvegarde JSON complète', async () => {
    const createRes = await request(app, 'POST', '/api/v1/concours', {
      nom: 'Concours sauvegardé',
      dateDebut: '2026-09-01',
      lieu: 'Lyon',
      organisateurId: 'org-1',
      typeEquipe: 'DOUBLETTE',
      nbTerrains: 2,
    });
    const id = createRes.body.id as string;

    const exportRes = await request(app, 'GET', `/api/v1/concours/${id}/sauvegarde`);
    expect(exportRes.status).toBe(200);
    expect(exportRes.body.version).toBe(1);

    const conflictRes = await request(app, 'POST', '/api/v1/concours/importer', {
      sauvegarde: exportRes.body,
      remplacer: false,
    });
    expect(conflictRes.status).toBe(409);

    const importRes = await request(app, 'POST', '/api/v1/concours/importer', {
      sauvegarde: exportRes.body,
      remplacer: true,
    });
    expect(importRes.status).toBe(200);
    expect(importRes.body.id).toBe(id);
    expect(importRes.body.remplace).toBe(true);

    const detailRes = await request(app, 'GET', `/api/v1/concours/${id}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.nom).toBe('Concours sauvegardé');
    expect(detailRes.body.lieu).toBe('Lyon');
    expect(detailRes.body.nbTerrains).toBe(2);
  });

  it('refuse une sauvegarde JSON incompatible', async () => {
    const res = await request(app, 'POST', '/api/v1/concours/importer', {
      sauvegarde: {
        version: 1,
        exportedAt: new Date().toISOString(),
        concours: { id: 'incomplet' },
      },
      remplacer: false,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalide/i);
  });

  it('annule le démarrage sans score et libère le terrain', async () => {
    const createRes = await request(app, 'POST', '/api/v1/concours', {
      nom: 'Concours avec remise en attente',
      dateDebut: '2026-10-01',
      organisateurId: 'org-1',
      typeEquipe: 'DOUBLETTE',
      nbEquipesMin: 4,
      nbTerrains: 2,
    });
    const id = createRes.body.id as string;
    await request(app, 'POST', `/api/v1/concours/${id}/ouvrir-inscriptions`);
    for (let index = 1; index <= 4; index++) {
      await request(app, 'POST', `/api/v1/concours/${id}/inscriptions`, {
        nomEquipe: `Equipe ${index}`,
      });
    }
    await request(app, 'POST', `/api/v1/concours/${id}/cloturer-inscriptions`);
    await request(app, 'POST', `/api/v1/concours/${id}/tirage`, { nbPoules: 1 });

    const matchsRes = await request(app, 'GET', `/api/v1/concours/${id}/matchs`);
    const match = (matchsRes.body.data as Array<Record<string, unknown>>)
      .find((item) => item.equipeBId !== null && item.terrainId !== null)!;
    const matchId = match.id as string;
    const terrainId = match.terrainId as string;

    const demarrageRes = await request(
      app,
      'POST',
      `/api/v1/concours/${id}/matchs/${matchId}/demarrer`,
    );
    expect(demarrageRes.status).toBe(200);

    const detailEnCours = await request(app, 'GET', `/api/v1/concours/${id}`);
    const terrainOccupe = (detailEnCours.body.terrains as Array<Record<string, unknown>>)
      .find((item) => item.id === terrainId)!;
    expect(terrainOccupe.occupe).toBe(true);

    const annulationRes = await request(
      app,
      'POST',
      `/api/v1/concours/${id}/matchs/${matchId}/annuler-demarrage`,
    );
    expect(annulationRes.status).toBe(200);
    expect(annulationRes.body.statut).toBe('PROGRAMME');

    const detailProgramme = await request(app, 'GET', `/api/v1/concours/${id}`);
    const terrainLibere = (detailProgramme.body.terrains as Array<Record<string, unknown>>)
      .find((item) => item.id === terrainId)!;
    expect(terrainLibere.occupe).toBe(false);

    const secondeAnnulationRes = await request(
      app,
      'POST',
      `/api/v1/concours/${id}/matchs/${matchId}/annuler-demarrage`,
    );
    expect(secondeAnnulationRes.status).toBe(409);

    await request(app, 'POST', `/api/v1/concours/${id}/matchs/${matchId}/demarrer`);
    await request(app, 'POST', `/api/v1/concours/${id}/matchs/${matchId}/score`, {
      scoreEquipeA: 13,
      scoreEquipeB: 7,
    });
    const correctionAvantFinTourRes = await request(
      app,
      'POST',
      `/api/v1/concours/${id}/matchs/${matchId}/corriger-score`,
      { scoreEquipeA: 13, scoreEquipeB: 8 },
    );
    expect(correctionAvantFinTourRes.status).toBe(200);

    const annulationApresScoreRes = await request(
      app,
      'POST',
      `/api/v1/concours/${id}/matchs/${matchId}/annuler-demarrage`,
    );
    expect(annulationApresScoreRes.status).toBe(400);

    const autreMatch = (matchsRes.body.data as Array<Record<string, unknown>>)
      .find((item) => item.id !== matchId && item.equipeBId !== null)!;
    const autreMatchId = autreMatch.id as string;
    await request(app, 'POST', `/api/v1/concours/${id}/matchs/${autreMatchId}/demarrer`);
    await request(app, 'POST', `/api/v1/concours/${id}/matchs/${autreMatchId}/score`, {
      scoreEquipeA: 13,
      scoreEquipeB: 9,
    });
    const tourSuivantRes = await request(app, 'POST', `/api/v1/concours/${id}/generer-tour-suivant`);
    expect(tourSuivantRes.status).toBe(201);

    const correctionApresFinTourRes = await request(
      app,
      'POST',
      `/api/v1/concours/${id}/matchs/${matchId}/corriger-score`,
      { scoreEquipeA: 8, scoreEquipeB: 13 },
    );
    expect(correctionApresFinTourRes.status).toBe(400);
    expect(correctionApresFinTourRes.body.error).toMatch(/tour est déjà terminé/i);
  });

  it('démarre atomiquement tous les matchs prêts', async () => {
    const createRes = await request(app, 'POST', '/api/v1/concours', {
      nom: 'Concours avec départ groupé',
      dateDebut: '2026-10-02',
      organisateurId: 'org-1',
      typeEquipe: 'DOUBLETTE',
      nbEquipesMin: 4,
      nbTerrains: 2,
    });
    const id = createRes.body.id as string;
    await request(app, 'POST', `/api/v1/concours/${id}/ouvrir-inscriptions`);
    for (let index = 1; index <= 4; index++) {
      await request(app, 'POST', `/api/v1/concours/${id}/inscriptions`, {
        nomEquipe: `Equipe départ ${index}`,
      });
    }
    await request(app, 'POST', `/api/v1/concours/${id}/cloturer-inscriptions`);
    await request(app, 'POST', `/api/v1/concours/${id}/tirage`, { nbPoules: 1 });

    const matchsAvant = await request(app, 'GET', `/api/v1/concours/${id}/matchs`);
    const matchIds = (matchsAvant.body.data as Array<Record<string, unknown>>)
      .filter((match) => match.equipeBId !== null && match.terrainId !== null)
      .map((match) => match.id as string);
    expect(matchIds).toHaveLength(2);

    const demarrageRes = await request(
      app,
      'POST',
      `/api/v1/concours/${id}/matchs/demarrer-tous`,
      { matchIds },
    );
    expect(demarrageRes.status).toBe(200);
    expect(demarrageRes.body.nbMatchsDemarres).toBe(2);

    const matchsApres = await request(app, 'GET', `/api/v1/concours/${id}/matchs`);
    const matchsDemarres = (matchsApres.body.data as Array<Record<string, unknown>>)
      .filter((match) => matchIds.includes(match.id as string));
    expect(matchsDemarres.every((match) => match.statut === 'EN_COURS')).toBe(true);

    const detail = await request(app, 'GET', `/api/v1/concours/${id}`);
    expect((detail.body.terrains as Array<Record<string, unknown>>)
      .every((terrain) => terrain.occupe === true)).toBe(true);

    await request(app, 'POST', `/api/v1/concours/${id}/matchs/${matchIds[0]}/annuler-demarrage`);
    const demarragePartielRes = await request(
      app,
      'POST',
      `/api/v1/concours/${id}/matchs/demarrer-tous`,
      { matchIds },
    );
    expect(demarragePartielRes.status).toBe(409);

    const matchsApresRefus = await request(app, 'GET', `/api/v1/concours/${id}/matchs`);
    const matchRemisEnAttente = (matchsApresRefus.body.data as Array<Record<string, unknown>>)
      .find((match) => match.id === matchIds[0]);
    expect(matchRemisEnAttente?.statut).toBe('PROGRAMME');
  });

  it('annule la dernière saisie de score et restaure le terrain occupé', async () => {
    const createRes = await request(app, 'POST', '/api/v1/concours', {
      nom: 'Concours avec annulation',
      dateDebut: '2026-10-01',
      organisateurId: 'org-1',
      typeEquipe: 'DOUBLETTE',
      nbEquipesMin: 4,
      nbTerrains: 2,
    });
    const id = createRes.body.id as string;
    await request(app, 'POST', `/api/v1/concours/${id}/ouvrir-inscriptions`);
    for (let index = 1; index <= 4; index++) {
      await request(app, 'POST', `/api/v1/concours/${id}/inscriptions`, {
        nomEquipe: `Equipe ${index}`,
      });
    }
    await request(app, 'POST', `/api/v1/concours/${id}/cloturer-inscriptions`);
    await request(app, 'POST', `/api/v1/concours/${id}/tirage`, { nbPoules: 1 });

    const matchsRes = await request(app, 'GET', `/api/v1/concours/${id}/matchs`);
    const match = (matchsRes.body.data as Array<Record<string, unknown>>)
      .find((item) => item.equipeBId !== null)!;
    const matchId = match.id as string;
    const terrainId = match.terrainId as string;
    const autreMatch = (matchsRes.body.data as Array<Record<string, unknown>>)
      .find((item) => item.id !== matchId && item.terrainId !== terrainId)!;
    const autreMatchId = autreMatch.id as string;
    const autreTerrainId = autreMatch.terrainId as string;

    const terrainRes = await request(
      app,
      'POST',
      `/api/v1/concours/${id}/matchs/${matchId}/terrain`,
      { terrainId: autreTerrainId },
    );
    expect(terrainRes.status).toBe(200);
    const detailTerrain = await request(app, 'GET', `/api/v1/concours/${id}`);
    expect((detailTerrain.body.derniereActionAnnulable as Record<string, unknown>).type)
      .toBe('TERRAIN');
    await request(app, 'POST', `/api/v1/concours/${id}/annuler-derniere-action`);

    const matchsApresTerrain = await request(app, 'GET', `/api/v1/concours/${id}/matchs`);
    const affectationsRestaurees = matchsApresTerrain.body.data as Array<Record<string, unknown>>;
    expect(affectationsRestaurees.find((item) => item.id === matchId)?.terrainId).toBe(terrainId);
    expect(affectationsRestaurees.find((item) => item.id === autreMatchId)?.terrainId)
      .toBe(autreTerrainId);

    await request(app, 'POST', `/api/v1/concours/${id}/matchs/${matchId}/demarrer`);
    const scoreRes = await request(app, 'POST', `/api/v1/concours/${id}/matchs/${matchId}/score`, {
      scoreEquipeA: 13,
      scoreEquipeB: 7,
    });
    expect(scoreRes.status).toBe(200);

    const detailAvant = await request(app, 'GET', `/api/v1/concours/${id}`);
    expect((detailAvant.body.derniereActionAnnulable as Record<string, unknown>).type)
      .toBe('SCORE');

    const undoRes = await request(app, 'POST', `/api/v1/concours/${id}/annuler-derniere-action`);
    expect(undoRes.status).toBe(200);
    expect(undoRes.body.annulee).toBe('Saisie du score 13–7');

    const matchsApres = await request(app, 'GET', `/api/v1/concours/${id}/matchs`);
    const matchRestaure = (matchsApres.body.data as Array<Record<string, unknown>>)
      .find((item) => item.id === matchId)!;
    expect(matchRestaure.statut).toBe('EN_COURS');
    expect(matchRestaure.score).toBeNull();

    const detailApres = await request(app, 'GET', `/api/v1/concours/${id}`);
    const terrainRestaure = (detailApres.body.terrains as Array<Record<string, unknown>>)
      .find((item) => item.id === terrainId)!;
    expect(terrainRestaure.occupe).toBe(true);
    expect(detailApres.body.derniereActionAnnulable).toBeNull();

    await request(app, 'POST', `/api/v1/concours/${id}/matchs/${matchId}/score`, {
      scoreEquipeA: 13,
      scoreEquipeB: 8,
    });
    await request(app, 'PATCH', `/api/v1/concours/${id}/visibilite`, { estPublic: false });
    const staleUndoRes = await request(
      app,
      'POST',
      `/api/v1/concours/${id}/annuler-derniere-action`,
    );
    expect(staleUndoRes.status).toBe(400);
    expect(staleUndoRes.body.error).toMatch(/Aucune action récente/);
  });
});
