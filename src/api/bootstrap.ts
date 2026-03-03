import { createApp } from './server.js';
import { InMemoryConcoursRepository } from '../infrastructure/repositories/in-memory-concours-repository.js';
import { InMemoryClubRepository } from '../infrastructure/repositories/in-memory-club-repository.js';
import { InMemoryJoueurRepository } from '../infrastructure/repositories/in-memory-joueur-repository.js';
import { InMemoryEventBus } from '../infrastructure/events/in-memory-event-bus.js';
import { AppContext } from './context.js';

/**
 * Construit le contexte applicatif.
 * Si DATABASE_URL est défini → DrizzleConcoursRepository (Neon/PostgreSQL).
 * Sinon → InMemoryConcoursRepository (dev sans DB, CI, tests).
 */
export async function buildContext(): Promise<AppContext> {
  let concoursRepository;

  if (process.env.DATABASE_URL) {
    const { DrizzleConcoursRepository } = await import('../infrastructure/repositories/drizzle-concours-repository.js');
    concoursRepository = new DrizzleConcoursRepository();
    console.log('📦 Persistance : Neon/PostgreSQL (Drizzle)');
  } else {
    concoursRepository = new InMemoryConcoursRepository();
    console.log('💾 Persistance : InMemory (pas de DATABASE_URL)');
  }

  return {
    concoursRepository,
    clubRepository: new InMemoryClubRepository(),
    joueurRepository: new InMemoryJoueurRepository(),
    eventPublisher: new InMemoryEventBus(),
  };
}

// ─── Démarrage serveur (entrée pour npm run dev / npm start) ─────────────────

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

buildContext().then(context => {
  const app = createApp(context);
  app.listen(PORT, () => {
    console.log(`🎳 ccOrgaTournoi API démarrée sur http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/api/health`);
    console.log(`   API base:     http://localhost:${PORT}/api/v1/concours`);
  });
});
