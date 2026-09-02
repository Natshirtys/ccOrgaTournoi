import { Concours } from '../../domain/concours/entities/concours.js';
import { Tour } from '../../domain/concours/entities/tour.js';
import { StatutMatch } from '../../domain/shared/enums.js';

/**
 * Auto-assigne un terrain disponible à chaque match d'un tour.
 * Privilégie les terrains sur lesquels les équipes n'ont pas encore joué (best effort).
 */
export function assignerTerrainsAuTour(concours: Concours, tour: Tour): void {
  // 1. Collecter les terrainIds réellement occupés (matchs EN_COURS seulement).
  // Les matchs PROGRAMME appartiennent à des tours futurs qui jouent séquentiellement :
  // leurs terrains seront libres quand le tour actuel commencera.
  const terrainsOccupes = new Set<string>();
  for (const phase of concours.phases) {
    for (const t of phase.tours) {
      if (t === tour) continue; // ignorer le tour qu'on est en train d'assigner
      for (const m of t.matchs) {
        if (m.terrainId && m.statut === StatutMatch.EN_COURS) {
          terrainsOccupes.add(m.terrainId);
        }
      }
    }
  }

  // 2. Terrains disponibles
  const terrainsDispos = concours.terrains
    .filter((t) => t.disponible && !terrainsOccupes.has(t.id))
    .map((t) => t.id);

  // 3. Construire l'historique terrain par équipe, ou par joueur pour les mêlées.
  // Les équipes d'une mêlée tournante changent à chaque partie : leurs identifiants
  // ne permettent donc pas de détecter qu'un joueur revient sur le même terrain.
  const historiqueParConcurrent = new Map<string, Map<string, number>>();
  const dernierTerrainParConcurrent = new Map<string, string>();
  for (const phase of concours.phases) {
    for (const t of phase.tours) {
      for (const m of t.matchs) {
        if (!m.terrainId) continue;
        for (const concurrentId of obtenirConcurrentIds(m)) {
          const historique = historiqueParConcurrent.get(concurrentId) ?? new Map<string, number>();
          historique.set(m.terrainId, (historique.get(m.terrainId) ?? 0) + 1);
          historiqueParConcurrent.set(concurrentId, historique);
          dernierTerrainParConcurrent.set(concurrentId, m.terrainId);
        }
      }
    }
  }

  // 4. Pour chaque match du tour, assigner le meilleur terrain
  const disponibles = [...terrainsDispos];

  for (const match of tour.matchs) {
    if (match.isBye || disponibles.length === 0) continue;

    const concurrentIds = obtenirConcurrentIds(match);

    // Scorer chaque terrain dispo
    let bestIdx = 0;
    let bestScore = Infinity;

    for (let i = 0; i < disponibles.length; i++) {
      const tid = disponibles[i];
      let score = 0;
      for (const concurrentId of concurrentIds) {
        // Éviter en priorité le terrain de la partie précédente, puis répartir
        // aussi les passages sur l'ensemble du concours.
        if (dernierTerrainParConcurrent.get(concurrentId) === tid) score += 1000;
        score += historiqueParConcurrent.get(concurrentId)?.get(tid) ?? 0;
      }
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    const chosenTerrainId = disponibles[bestIdx];
    match.assignerTerrain(chosenTerrainId);

    // Mettre à jour l'historique
    for (const concurrentId of concurrentIds) {
      const historique = historiqueParConcurrent.get(concurrentId) ?? new Map<string, number>();
      historique.set(chosenTerrainId, (historique.get(chosenTerrainId) ?? 0) + 1);
      historiqueParConcurrent.set(concurrentId, historique);
      dernierTerrainParConcurrent.set(concurrentId, chosenTerrainId);
    }

    // Retirer de la liste des disponibles
    disponibles.splice(bestIdx, 1);
  }
}

function obtenirConcurrentIds(match: import('../../domain/concours/entities/match.js').Match): string[] {
  const participantIds = [...match.participantIdsEquipeA, ...match.participantIdsEquipeB];
  if (participantIds.length > 0) return participantIds;
  return [match.equipeAId, ...(match.equipeBId ? [match.equipeBId] : [])];
}

/**
 * Après qu'un match se termine, vérifie si le tour courant est complet.
 * Si oui, assigne les terrains aux tours suivants de la même phase qui n'en ont pas encore.
 * Permet de gérer les tirages existants et les modes où tous les tours sont pré-générés (CHAMPIONNAT).
 */
export function assignerTerrainsToursNonAssignes(
  concours: Concours,
  tourCourant: Tour,
  phaseTours: readonly Tour[],
): void {
  const tourComplet = tourCourant.matchs.every(
    (m) => m.isBye || m.statut === StatutMatch.TERMINE || m.statut === StatutMatch.FORFAIT,
  );
  if (!tourComplet) return;

  const toursAAssigner = phaseTours
    .filter((t) => t.numero > tourCourant.numero)
    .filter((t) => t.matchs.some((m) => !m.isBye && !m.terrainId));

  for (const tour of toursAAssigner) {
    assignerTerrainsAuTour(concours, tour);
  }
}
