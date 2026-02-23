import { createApp } from './server.js';
import { InMemoryConcoursRepository } from '../infrastructure/repositories/in-memory-concours-repository.js';
import { InMemoryClubRepository } from '../infrastructure/repositories/in-memory-club-repository.js';
import { InMemoryJoueurRepository } from '../infrastructure/repositories/in-memory-joueur-repository.js';
import { InMemoryEventBus } from '../infrastructure/events/in-memory-event-bus.js';
import { AppContext } from './context.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// ─── Composition Root ───────────────────────────────────────────────────────

const concoursRepository = new InMemoryConcoursRepository();
const clubRepository = new InMemoryClubRepository();
const joueurRepository = new InMemoryJoueurRepository();
const eventPublisher = new InMemoryEventBus();

const context: AppContext = {
  concoursRepository,
  clubRepository,
  joueurRepository,
  eventPublisher,
};

// ─── Start ──────────────────────────────────────────────────────────────────

const app = createApp(context);

app.listen(PORT, () => {
  console.log(`🎳 ccOrgaTournoi API démarrée sur http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  console.log(`   API base:     http://localhost:${PORT}/api/v1/concours`);
});
