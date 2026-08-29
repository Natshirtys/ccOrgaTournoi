export type StatutConcours =
  | 'BROUILLON'
  | 'INSCRIPTIONS_OUVERTES'
  | 'INSCRIPTIONS_CLOSES'
  | 'TIRAGE_EN_COURS'
  | 'EN_COURS'
  | 'TERMINE'
  | 'ARCHIVE';

export type TypeEquipe = 'TETE_A_TETE' | 'DOUBLETTE' | 'TRIPLETTE' | 'QUADRETTE';

export interface ConcoursSummary {
  id: string;
  nom: string;
  dates: { debut: string; fin: string };
  lieu: string;
  organisateurId: string;
  statut: StatutConcours;
  estPublic: boolean;
  nbEquipesInscrites: number;
  nbTerrains: number;
  nbPhases: number;
  formule: {
    typeEquipe: TypeEquipe;
    typePhase?: TypePhase;
    nbEquipesMin: number;
    nbEquipesMax: number;
  };
}

export type TypePhase =
  | 'POULES'
  | 'ELIMINATION_SIMPLE'
  | 'ELIMINATION_DOUBLE'
  | 'SYSTEME_SUISSE'
  | 'CHAMPIONNAT'
  | 'CONSOLANTE'
  | 'BARRAGE'
  | 'REPECHAGE';

export type StatutMatch =
  | 'PROGRAMME'
  | 'EN_COURS'
  | 'SCORE_SAISI'
  | 'TERMINE'
  | 'FORFAIT'
  | 'ABANDON'
  | 'BYE'
  | 'EN_CORRECTION';

export type TypeResultat = 'VICTOIRE' | 'NUL' | 'FORFAIT' | 'ABANDON' | 'BYE';
export type StatutPhase = 'EN_ATTENTE' | 'EN_COURS' | 'TERMINEE';

export interface TerrainDto {
  id: string;
  numero: number;
  nom: string;
  actif: boolean;
  occupe: boolean;
  disponible: boolean;
}

export interface InscriptionDto {
  id: string;
  equipeId: string;
  nomEquipe: string;
  joueurs?: string[];
  club?: string;
  teteDeSerie: boolean;
}

export interface PhaseDto {
  id: string;
  type: TypePhase;
  ordre: number;
  statut: StatutPhase;
  nom?: string; // "Championnat A", "Championnat B", "Championnat C"
  nbTours?: number;
  classement?: unknown[] | null;
}

export interface ConcoursDetail extends ConcoursSummary {
  prochaineAction: ProchaineActionDto;
  derniereActionAnnulable: DerniereActionAnnulableDto | null;
  terrains: TerrainDto[];
  inscriptions: InscriptionDto[];
  phases: PhaseDto[];
}

export interface DerniereActionAnnulableDto {
  type: 'DEMARRAGE_MATCH' | 'SCORE' | 'FORFAIT' | 'TERRAIN' | 'CORRECTION_SCORE';
  libelle: string;
  creeLe: string;
}

export type CodeProchaineAction =
  | 'OUVRIR_INSCRIPTIONS'
  | 'COMPLETER_INSCRIPTIONS'
  | 'CLOTURER_INSCRIPTIONS'
  | 'LANCER_TIRAGE'
  | 'JOUER_MATCHS'
  | 'GENERER_SUITE'
  | 'TERMINER_CONCOURS'
  | 'AUCUNE';

export interface ProchaineActionDto {
  code: CodeProchaineAction;
  titre: string;
  description: string;
  progression?: {
    valeur: number;
    total: number;
    libelle: string;
  };
}

export interface MatchDto {
  id: string;
  tourNumero: number;
  tourNom?: string;
  phaseId: string;
  phaseType: TypePhase;
  phaseNom?: string;
  terrainId: string | null;
  terrainNumero: number | null;
  terrainNom: string | null;
  equipeAId: string;
  equipeBId: string | null;
  statut: StatutMatch;
  score: { equipeA: number; equipeB: number } | null;
  resultat: TypeResultat | null;
  canEditScore: boolean;
}

export interface LigneClassementDto {
  rang: number;
  equipeId: string;
  points: number;
  victoires: number;
  nuls: number;
  defaites: number;
  pointsMarques: number;
  pointsEncaisses: number;
  goalAverage: number;
  qualifiee: boolean;
}

export interface CreateConcoursPayload {
  nom: string;
  dateDebut: string;
  dateFin?: string;
  lieu?: string;
  organisateurId?: string;
  typeEquipe: TypeEquipe;
  typePhase?: TypePhase;
  nbTerrains: number;
}

export interface InscrireEquipePayload {
  nomEquipe: string;
  joueurs?: string[];
  club?: string;
  teteDeSerie: boolean;
}

export interface SaisirScorePayload {
  scoreEquipeA: number;
  scoreEquipeB: number;
}

export interface DeclarerForfaitPayload {
  equipeDeclarantForfaitId: string;
}

export interface LancerTiragePayload {
  nbPoules?: number;
}

export interface SauvegardeConcours {
  version: 1;
  exportedAt: string;
  concours: Record<string, unknown>;
}

export interface ImportConcoursResult {
  id: string;
  nom: string;
  remplace: boolean;
}
