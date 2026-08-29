import type { SauvegardeConcours } from '@/types/concours';

export const BACKUP_MAX_SIZE = 1024 * 1024;

export function parseSauvegardeConcours(content: string): SauvegardeConcours {
  const parsed: unknown = JSON.parse(content);
  if (
    typeof parsed !== 'object'
    || parsed === null
    || !('version' in parsed)
    || parsed.version !== 1
    || !('exportedAt' in parsed)
    || typeof parsed.exportedAt !== 'string'
    || !('concours' in parsed)
    || typeof parsed.concours !== 'object'
    || parsed.concours === null
  ) {
    throw new Error('Ce fichier n’est pas une sauvegarde de concours compatible.');
  }

  return parsed as SauvegardeConcours;
}

export function telechargerSauvegarde(
  sauvegarde: SauvegardeConcours,
  nomConcours: string,
): void {
  const nomSecurise = nomConcours
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'concours';
  const blob = new Blob([JSON.stringify(sauvegarde, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = `sauvegarde-${nomSecurise}.json`;
  lien.click();
  URL.revokeObjectURL(url);
}
