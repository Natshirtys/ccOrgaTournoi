import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../../api/server.js';
import { InMemoryConcoursRepository } from '../../infrastructure/repositories/in-memory-concours-repository.js';
import { InMemoryClubRepository } from '../../infrastructure/repositories/in-memory-club-repository.js';
import { InMemoryJoueurRepository } from '../../infrastructure/repositories/in-memory-joueur-repository.js';
import { InMemoryEventBus } from '../../infrastructure/events/in-memory-event-bus.js';
import { AuthService } from '../../api/auth/auth-service.js';
import { AppContext } from '../../api/context.js';
import express from 'express';

const TEST_SECRET = 'test-secret-key-for-vitest';
const TEST_EMAIL = 'admin@test.fr';
const TEST_PASSWORD = 'password123';

async function request(
  app: express.Express,
  method: string,
  path: string,
  body?: unknown,
  token?: string,
) {
  return new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
    const server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      const url = `http://localhost:${port}${path}`;

      const headers: Record<string, string> = {};
      if (body) headers['Content-Type'] = 'application/json';
      if (token) headers['Authorization'] = `Bearer ${token}`;

      fetch(url, {
        method,
        headers,
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
          reject(err);
        });
    });
  });
}

function buildContext(withAuth = true): AppContext {
  const authService = withAuth
    ? new AuthService({
        jwtSecret: TEST_SECRET,
        adminEmail: TEST_EMAIL,
        adminPassword: TEST_PASSWORD,
        tokenExpiresIn: '1h',
      })
    : undefined;

  return {
    concoursRepository: new InMemoryConcoursRepository(),
    clubRepository: new InMemoryClubRepository(),
    joueurRepository: new InMemoryJoueurRepository(),
    eventPublisher: new InMemoryEventBus(),
    authService,
  };
}

// ─── AuthService unit tests ───────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService({
      jwtSecret: TEST_SECRET,
      adminEmail: TEST_EMAIL,
      adminPassword: TEST_PASSWORD,
      tokenExpiresIn: '1h',
    });
  });

  it('retourne un token pour les bonnes credentials', () => {
    const token = service.login(TEST_EMAIL, TEST_PASSWORD);
    expect(token).not.toBeNull();
    expect(typeof token).toBe('string');
  });

  it('retourne null pour un mauvais mot de passe', () => {
    expect(service.login(TEST_EMAIL, 'mauvais')).toBeNull();
  });

  it('retourne null pour un mauvais email', () => {
    expect(service.login('autre@test.fr', TEST_PASSWORD)).toBeNull();
  });

  it('verifyToken retourne le user pour un token valide', () => {
    const token = service.login(TEST_EMAIL, TEST_PASSWORD)!;
    const user = service.verifyToken(token);
    expect(user).not.toBeNull();
    expect(user?.email).toBe(TEST_EMAIL);
    expect(user?.role).toBe('admin');
  });

  it('verifyToken retourne null pour un token invalide', () => {
    expect(service.verifyToken('token.faux.invalide')).toBeNull();
  });
});

// ─── Routes auth ─────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  let app: express.Express;
  let authService: AuthService;

  beforeEach(() => {
    const ctx = buildContext(true);
    app = createApp(ctx);
    authService = ctx.authService!;
  });

  it('retourne un token avec les bonnes credentials', async () => {
    const res = await request(app, 'POST', '/api/v1/auth/login', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
  });

  it('retourne 401 avec de mauvaises credentials', async () => {
    const res = await request(app, 'POST', '/api/v1/auth/login', {
      email: TEST_EMAIL,
      password: 'mauvais',
    });
    expect(res.status).toBe(401);
  });

  it('retourne 400 si le body est invalide', async () => {
    const res = await request(app, 'POST', '/api/v1/auth/login', {
      email: 'pasunemail',
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/auth/me', () => {
  let app: express.Express;
  let authService: AuthService;

  beforeEach(() => {
    const ctx = buildContext(true);
    app = createApp(ctx);
    authService = ctx.authService!;
  });

  it('retourne le user connecté avec un token valide', async () => {
    const token = authService.login(TEST_EMAIL, TEST_PASSWORD)!;
    const res = await request(app, 'GET', '/api/v1/auth/me', undefined, token);
    expect(res.status).toBe(200);
    expect((res.body.user as Record<string, unknown>)?.email).toBe(TEST_EMAIL);
  });

  it('retourne 401 sans token', async () => {
    const res = await request(app, 'GET', '/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});

// ─── Protection des routes mutantes ──────────────────────────────────────────

describe('Routes protégées — sans auth activée (no-op)', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createApp(buildContext(false));
  });

  it('POST /concours passe sans token quand authService absent', async () => {
    const res = await request(app, 'POST', '/api/v1/concours', {
      nom: 'Test',
      dateDebut: '2026-06-01',
      typeEquipe: 'DOUBLETTE',
    });
    expect(res.status).toBe(201);
  });
});

describe('Routes protégées — avec auth activée', () => {
  let app: express.Express;
  let authService: AuthService;

  beforeEach(() => {
    const ctx = buildContext(true);
    app = createApp(ctx);
    authService = ctx.authService!;
  });

  it('POST /concours retourne 401 sans token', async () => {
    const res = await request(app, 'POST', '/api/v1/concours', {
      nom: 'Test',
      dateDebut: '2026-06-01',
      typeEquipe: 'DOUBLETTE',
    });
    expect(res.status).toBe(401);
  });

  it('POST /concours passe avec un token valide', async () => {
    const token = authService.login(TEST_EMAIL, TEST_PASSWORD)!;
    const res = await request(app, 'POST', '/api/v1/concours', {
      nom: 'Test Auth',
      dateDebut: '2026-06-01',
      typeEquipe: 'DOUBLETTE',
    }, token);
    expect(res.status).toBe(201);
  });

  it('GET /concours reste public (lecture libre)', async () => {
    const res = await request(app, 'GET', '/api/v1/concours');
    expect(res.status).toBe(200);
  });
});
