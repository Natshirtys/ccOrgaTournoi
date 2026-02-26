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
          const json = await res.json() as Record<string, unknown>;
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
});
