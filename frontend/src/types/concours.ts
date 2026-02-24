export type StatutConcours =
  | 'BROUILLON'
  | 'INSCRIPTIONS_OUVERTES'
  | 'INSCRIPTIONS_CLOSES'
  | 'TIRAGE_EN_COURS'
  | 'EN_COURS'
  | 'TERMINE'
  | 'ARCHIVE'
  | 'ANNULE';

export type TypeEquipe = 'TETE_A_TETE' | 'DOUBLETTE' | 'TRIPLETTE' | 'QUADRETTE';

export interface ConcoursSummary {
  id: string;
  nom: string;
  dates: { debut: string; fin: string };
  lieu: string;
  organisateurId: string;
  statut: StatutConcours;
  nbEquipesInscrites: number;
  nbTerrains: number;
  nbPhases: number;
  formule: {
    typeEquipe: TypeEquipe;
    nbEquipesMin: number;
    nbEquipesMax: number;
  };
}

export type TypePhase = 'POULES' | 'SYSTEME_SUISSE' | 'CHAMPIONNAT' | 'ELIMINATION_SIMPLE';

export type StatutMatch = 'PROGRAMME' | 'EN_COURS' | 'TERMINE' | 'FORFAIT';

export interface TerrainDto {
  id: string;
  numero: number;
  nom: string;
  disponible: boolean;
}

export interface InscriptionDto {
  id: string;
  equipeId: string;
  nomEquipe: string;
  joueurs: string[];
  club: string;
  teteDeSerie: boolean;
}

export interface PhaseDto {
  id: string;
  type: TypePhase;
  numero: number;
  statut: string;
}

export interface ConcoursDetail extends ConcoursSummary {
  terrains: TerrainDto[];
  inscriptions: InscriptionDto[];
  phases: PhaseDto[];
}

export interface MatchDto {
  id: string;
  tourNumero: number;
  terrainId?: string;
  equipeAId: string;
  equipeBId: string;
  statut: StatutMatch;
  score?: { equipeA: number; equipeB: number };
  resultat?: string;
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
  dateFin: string;
  lieu: string;
  organisateurId: string;
  typeEquipe: TypeEquipe;
  typePhase?: TypePhase;
}

export interface InscrireEquipePayload {
  nomEquipe: string;
  joueurs: string[];
  club: string;
  teteDeSerie: boolean;
}

export interface AjouterTerrainPayload {
  numero: number;
  nom: string;
}

export interface SaisirScorePayload {
  scoreEquipeA: number;
  scoreEquipeB: number;
}

export interface DeclarerForfaitPayload {
  equipeDeclarantForfaitId: string;
}

export interface LancerTiragePayload {
  typePhase: TypePhase;
}
