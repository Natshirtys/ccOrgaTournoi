import { beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import { createApp } from '../../api/server.js';
import { AppContext } from '../../api/context.js';
import { InMemoryConcoursRepository } from '../../infrastructure/repositories/in-memory-concours-repository.js';
import { InMemoryClubRepository } from '../../infrastructure/repositories/in-memory-club-repository.js';
import { InMemoryJoueurRepository } from '../../infrastructure/repositories/in-memory-joueur-repository.js';
import { InMemoryEventBus } from '../../infrastructure/events/in-memory-event-bus.js';

async function request(app: express.Express, method: string, path: string, body?: unknown) {
  return new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
    const server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      fetch(`http://localhost:${port}${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      }).then(async (response) => {
        const text = await response.text();
        server.close();
        resolve({ status: response.status, body: text ? JSON.parse(text) as Record<string, unknown> : {} });
      }).catch((error) => {
        server.close();
        reject(error);
      });
    });
  });
}

describe('API Joueurs du club', () => {
  let app: express.Express;

  beforeEach(() => {
    const ctx: AppContext = {
      concoursRepository: new InMemoryConcoursRepository(),
      clubRepository: new InMemoryClubRepository(),
      joueurRepository: new InMemoryJoueurRepository(),
      eventPublisher: new InMemoryEventBus(),
    };
    app = createApp(ctx);
  });

  it('crée, liste et modifie un joueur avec son poste', async () => {
    const createRes = await request(app, 'POST', '/api/v1/joueurs-club', {
      nom: 'Jean Dupont', poste: 'POINTEUR',
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body).toMatchObject({ nom: 'Jean Dupont', poste: 'POINTEUR', actif: true });

    const id = createRes.body.id as string;
    const updateRes = await request(app, 'PATCH', `/api/v1/joueurs-club/${id}`, {
      nom: 'Jean Dupont', poste: 'TIREUR',
    });
    expect(updateRes.body.poste).toBe('TIREUR');

    const listRes = await request(app, 'GET', '/api/v1/joueurs-club');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toEqual([expect.objectContaining({ id, nom: 'Jean Dupont', poste: 'TIREUR' })]);
  });

  it('désactive un joueur sans le supprimer', async () => {
    const createRes = await request(app, 'POST', '/api/v1/joueurs-club', {
      nom: 'Marie Martin', poste: 'POLYVALENT',
    });
    const id = createRes.body.id as string;
    const toggleRes = await request(app, 'PATCH', `/api/v1/joueurs-club/${id}/disponibilite`, { actif: false });
    expect(toggleRes.body.actif).toBe(false);

    const listRes = await request(app, 'GET', '/api/v1/joueurs-club');
    expect((listRes.body.data as Array<Record<string, unknown>>)[0].actif).toBe(false);
  });

  it('refuse les doublons de nom et permet une suppression définitive', async () => {
    const firstRes = await request(app, 'POST', '/api/v1/joueurs-club', {
      nom: 'Luc Bernard', poste: 'TIREUR',
    });
    const duplicateRes = await request(app, 'POST', '/api/v1/joueurs-club', {
      nom: '  luc bernard ', poste: 'POINTEUR',
    });
    expect(duplicateRes.status).toBe(409);

    const deleteRes = await request(app, 'DELETE', `/api/v1/joueurs-club/${firstRes.body.id as string}`);
    expect(deleteRes.status).toBe(204);
    const listRes = await request(app, 'GET', '/api/v1/joueurs-club');
    expect(listRes.body.data).toEqual([]);
  });
});
