import { EntityId } from '../../../shared/types.js';

export interface FeuilleMatchData {
  concoursNom: string;
  matchNumero: number;
  terrainNom: string;
  equipeA: { nom: string; joueurs: string[] };
  equipeB: { nom: string; joueurs: string[] };
  horaire: Date | null;
}

export interface DocumentGenerator {
  genererFeuilleMatch(data: FeuilleMatchData): Promise<Uint8Array>;
  genererClassement(concoursId: EntityId, phaseId: EntityId): Promise<Uint8Array>;
}

export interface ExportService {
  exporterPDF(concoursId: EntityId): Promise<Uint8Array>;
  exporterExcel(concoursId: EntityId): Promise<Uint8Array>;
}
