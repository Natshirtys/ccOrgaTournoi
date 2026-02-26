import { apiFetch } from './client';
import type {
  ConcoursSummary,
  ConcoursDetail,
  CreateConcoursPayload,
  InscrireEquipePayload,
  LancerTiragePayload,
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

export function lancerTirage(id: string, payload: LancerTiragePayload): Promise<void> {
  return apiFetch(`/concours/${id}/tirage`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function annulerConcours(id: string): Promise<{ statut: string }> {
  return apiFetch(`/concours/${id}/annuler`, { method: 'POST' });
}

export function genererTourSuivant(id: string): Promise<void> {
  return apiFetch(`/concours/${id}/generer-tour-suivant`, { method: 'POST' });
}
