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
          const json = await res.json();
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

    // 4. Inscrire 4 triplettes
    for (let i = 1; i <= 4; i++) {
      const inscRes = await request(app, 'POST', `/api/v1/concours/${concoursId}/inscriptions`, {
        equipeNom: `Equipe ${i}`,
        joueurIds: [`j-${i}a`, `j-${i}b`, `j-${i}c`],
        clubId: `club-${i}`,
      });
      expect(inscRes.status).toBe(201);
    }

    // 5. Clôturer
    const cloturerRes = await request(app, 'POST', `/api/v1/concours/${concoursId}/cloturer-inscriptions`);
    expect(cloturerRes.status).toBe(200);

    // 6. Tirage
    const tirageRes = await request(app, 'POST', `/api/v1/concours/${concoursId}/tirage`, {
      nbPoules: 1,
    });
    expect(tirageRes.status).toBe(201);
    expect(tirageRes.body.statut).toBe('EN_COURS');
    expect(tirageRes.body.nbTours).toBe(3); // 4 équipes en 1 poule = 3 tours

    // 7. Lister les matchs
    const matchsRes = await request(app, 'GET', `/api/v1/concours/${concoursId}/matchs`);
    expect(matchsRes.status).toBe(200);
    const matchs = matchsRes.body.data as Array<{ id: string; equipeAId: string; equipeBId: string | null; statut: string }>;
    expect(matchs.length).toBe(6); // 4*3/2

    // 8. Jouer tous les matchs (démarrer + saisir score)
    for (const match of matchs) {
      if (!match.equipeBId) continue; // skip BYE

      await request(app, 'POST', `/api/v1/concours/${concoursId}/matchs/${match.id}/demarrer`);

      await request(app, 'POST', `/api/v1/concours/${concoursId}/matchs/${match.id}/score`, {
        scoreA: 13,
        scoreB: 8,
      });
    }

    // 9. Classement
    const classementRes = await request(app, 'GET', `/api/v1/concours/${concoursId}/classement`);
    expect(classementRes.status).toBe(200);
    const classement = classementRes.body.classement as Array<{ rang: number; equipeId: string; points: number }>;
    expect(classement).toHaveLength(4);
    expect(classement[0].rang).toBe(1);
    expect(classement[0].points).toBeGreaterThan(0);
  });
});
