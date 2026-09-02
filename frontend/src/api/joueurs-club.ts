import { apiFetch } from './client';
import type { JoueurClubDto, JoueurClubPayload } from '@/types/concours';

export function fetchJoueursClub(): Promise<{ data: JoueurClubDto[] }> {
  return apiFetch('/joueurs-club');
}

export function ajouterJoueurClub(payload: JoueurClubPayload): Promise<JoueurClubDto> {
  return apiFetch('/joueurs-club', { method: 'POST', body: JSON.stringify(payload) });
}

export function modifierJoueurClub(id: string, payload: JoueurClubPayload): Promise<JoueurClubDto> {
  return apiFetch(`/joueurs-club/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function definirJoueurClubActif(id: string, actif: boolean): Promise<JoueurClubDto> {
  return apiFetch(`/joueurs-club/${id}/disponibilite`, {
    method: 'PATCH',
    body: JSON.stringify({ actif }),
  });
}

export function supprimerJoueurClub(id: string): Promise<void> {
  return apiFetch(`/joueurs-club/${id}`, { method: 'DELETE' });
}
