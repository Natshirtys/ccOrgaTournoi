import { apiFetch } from './client';
import type {
  MatchDto,
  LigneClassementDto,
  SaisirScorePayload,
  DeclarerForfaitPayload,
} from '../types/concours';

export function fetchMatchs(concoursId: string): Promise<{ data: MatchDto[] }> {
  return apiFetch(`/concours/${concoursId}/matchs`);
}

export function demarrerMatch(concoursId: string, matchId: string): Promise<void> {
  return apiFetch(`/concours/${concoursId}/matchs/${matchId}/demarrer`, {
    method: 'POST',
  });
}

export function saisirScore(
  concoursId: string,
  matchId: string,
  payload: SaisirScorePayload,
): Promise<void> {
  return apiFetch(`/concours/${concoursId}/matchs/${matchId}/score`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function declarerForfait(
  concoursId: string,
  matchId: string,
  payload: DeclarerForfaitPayload,
): Promise<void> {
  return apiFetch(`/concours/${concoursId}/matchs/${matchId}/forfait`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function corrigerScore(
  concoursId: string,
  matchId: string,
  payload: SaisirScorePayload,
): Promise<void> {
  return apiFetch(`/concours/${concoursId}/matchs/${matchId}/corriger-score`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function assignerTerrain(
  concoursId: string,
  matchId: string,
  terrainId: string,
): Promise<void> {
  return apiFetch(`/concours/${concoursId}/matchs/${matchId}/terrain`, {
    method: 'POST',
    body: JSON.stringify({ terrainId }),
  });
}

export function fetchClassement(concoursId: string): Promise<{ phaseId: string; classement: LigneClassementDto[] }> {
  return apiFetch(`/concours/${concoursId}/classement`);
}
