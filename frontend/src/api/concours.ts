import { apiFetch } from './client';
import type {
  ConcoursSummary,
  ConcoursDetail,
  CreateConcoursPayload,
  InscrireEquipePayload,
  LancerTiragePayload,
  ImportConcoursResult,
  SauvegardeConcours,
} from '../types/concours';

export function fetchConcours(): Promise<{ data: ConcoursSummary[] }> {
  return apiFetch('/concours');
}

export function fetchConcoursDetail(id: string): Promise<ConcoursDetail> {
  return apiFetch(`/concours/${id}`);
}

export function createConcours(payload: CreateConcoursPayload): Promise<ConcoursSummary> {
  return apiFetch('/concours', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function ouvrirInscriptions(id: string): Promise<{ statut: string }> {
  return apiFetch(`/concours/${id}/ouvrir-inscriptions`, { method: 'POST' });
}

export function cloturerInscriptions(id: string): Promise<{ statut: string }> {
  return apiFetch(`/concours/${id}/cloturer-inscriptions`, { method: 'POST' });
}

export function inscrireEquipe(id: string, payload: InscrireEquipePayload): Promise<void> {
  return apiFetch(`/concours/${id}/inscriptions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function modifierInscription(
  concoursId: string,
  inscriptionId: string,
  payload: InscrireEquipePayload,
): Promise<void> {
  return apiFetch(`/concours/${concoursId}/inscriptions/${inscriptionId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function annulerInscription(concoursId: string, inscriptionId: string): Promise<void> {
  return apiFetch(`/concours/${concoursId}/inscriptions/${inscriptionId}`, {
    method: 'DELETE',
  });
}

export function lancerTirage(id: string, payload: LancerTiragePayload): Promise<void> {
  return apiFetch(`/concours/${id}/tirage`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function genererTourSuivant(id: string, phaseId?: string): Promise<void> {
  return apiFetch(`/concours/${id}/generer-tour-suivant`, {
    method: 'POST',
    body: phaseId ? JSON.stringify({ phaseId }) : undefined,
  });
}

export function terminerConcours(id: string): Promise<{ statut: string }> {
  return apiFetch(`/concours/${id}/terminer`, { method: 'POST' });
}

export function archiverConcours(id: string): Promise<{ statut: string; estPublic: boolean }> {
  return apiFetch(`/concours/${id}/archiver`, { method: 'POST' });
}

export function modifierVisibiliteConcours(id: string, estPublic: boolean): Promise<{ estPublic: boolean }> {
  return apiFetch(`/concours/${id}/visibilite`, {
    method: 'PATCH',
    body: JSON.stringify({ estPublic }),
  });
}

export function modifierDisponibiliteTerrain(
  concoursId: string,
  terrainId: string,
  actif: boolean,
): Promise<{ actif: boolean; occupe: boolean; disponible: boolean }> {
  return apiFetch(`/concours/${concoursId}/terrains/${terrainId}/disponibilite`, {
    method: 'PATCH',
    body: JSON.stringify({ actif }),
  });
}

export function supprimerConcours(id: string): Promise<void> {
  return apiFetch(`/concours/${id}`, { method: 'DELETE' });
}

export function exporterSauvegardeConcours(id: string): Promise<SauvegardeConcours> {
  return apiFetch(`/concours/${id}/sauvegarde`);
}

export function importerSauvegardeConcours(
  sauvegarde: SauvegardeConcours,
  remplacer: boolean,
): Promise<ImportConcoursResult> {
  return apiFetch('/concours/importer', {
    method: 'POST',
    body: JSON.stringify({ sauvegarde, remplacer }),
  });
}
