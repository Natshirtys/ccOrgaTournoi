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
    .filter((t) => !terrainsOccupes.has(t.id))
    .map((t) => t.id);

  // 3. Construire l'historique terrain par équipe (tous matchs passés du concours)
  const historiqueParEquipe = new Map<string, Set<string>>();
  for (const phase of concours.phases) {
    for (const t of phase.tours) {
      for (const m of t.matchs) {
        if (!m.terrainId) continue;
        if (!historiqueParEquipe.has(m.equipeAId)) {
          historiqueParEquipe.set(m.equipeAId, new Set());
        }
        historiqueParEquipe.get(m.equipeAId)!.add(m.terrainId);
        if (m.equipeBId) {
          if (!historiqueParEquipe.has(m.equipeBId)) {
            historiqueParEquipe.set(m.equipeBId, new Set());
          }
          historiqueParEquipe.get(m.equipeBId)!.add(m.terrainId);
        }
      }
    }
  }

  // 4. Pour chaque match du tour, assigner le meilleur terrain
  const disponibles = [...terrainsDispos];

  for (const match of tour.matchs) {
    if (match.isBye || disponibles.length === 0) continue;

    const histA = historiqueParEquipe.get(match.equipeAId);
    const histB = match.equipeBId ? historiqueParEquipe.get(match.equipeBId) : undefined;

    // Scorer chaque terrain dispo
    let bestIdx = 0;
    let bestScore = Infinity;

    for (let i = 0; i < disponibles.length; i++) {
      const tid = disponibles[i];
      let score = 0;
      if (histA?.has(tid)) score++;
      if (histB?.has(tid)) score++;
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    const chosenTerrainId = disponibles[bestIdx];
    match.assignerTerrain(chosenTerrainId);

    // Mettre à jour l'historique
    if (!historiqueParEquipe.has(match.equipeAId)) {
      historiqueParEquipe.set(match.equipeAId, new Set());
    }
    historiqueParEquipe.get(match.equipeAId)!.add(chosenTerrainId);
    if (match.equipeBId) {
      if (!historiqueParEquipe.has(match.equipeBId)) {
        historiqueParEquipe.set(match.equipeBId, new Set());
      }
      historiqueParEquipe.get(match.equipeBId)!.add(chosenTerrainId);
    }

    // Retirer de la liste des disponibles
    disponibles.splice(bestIdx, 1);
  }
}
