/**
 * Interfaces de sérialisation JSON pour la persistance JSONB dans Neon.
 * Toutes les dates sont stockées en ISO-8601 (string).
 * GoalAverage : seuls pointsMarques + pointsEncaisses sont stockés
 * (difference/quotient sont recalculés au constructeur ; Infinity ne survit pas à JSON.stringify).
 */

export interface GoalAverageData {
  pointsMarques: number;
  pointsEncaisses: number;
}

export interface ScoreData {
  pointsA: number;
  pointsB: number;
}

export interface ResultatMatchData {
  vainqueur: string | null;
  type: string;
  score: ScoreData;
  pointsAttribuesA: number;
  pointsAttribuesB: number;
}

export interface MatchData {
  id: string;
  tourId: string;
  equipeAId: string;
  equipeBId: string | null;
  terrainId: string | null;
  horaire: string | null;
  statut: string;
  score: ScoreData | null;
  resultat: ResultatMatchData | null;
}

export interface TourData {
  id: string;
  phaseId: string;
  numero: number;
  statut: string;
  matchs: MatchData[];
  nom?: string;
}

export interface LigneClassementData {
  equipeId: string;
  rang: number;
  points: number;
  matchsJoues: number;
  matchsGagnes: number;
  matchsPerdus: number;
  matchsNuls: number;
  pointsMarques: number;
  pointsEncaisses: number;
  goalAverage: GoalAverageData;
  qualifiee: boolean;
}

export interface ClassementData {
  phaseId: string;
  lignes: LigneClassementData[];
  criteres: string[];
}

export interface QualificationRuleData {
  type: string;
  nombre: number;
  critere: string;
}

export interface PhaseConstraintsData {
  protectionClub?: boolean;
  tetesDeSerieCount?: number;
  nulAutorise?: boolean;
  nbPoules?: number;
  taillePoule?: number;
}

export interface PhaseDefinitionData {
  type: string;
  drawStrategy: string;
  rankingCriteria: string[];
  tiebreakChain: string[];
  qualificationRule: QualificationRuleData | null;
  constraints: PhaseConstraintsData;
}

export interface PhaseData {
  id: string;
  concoursId: string;
  type: string;
  ordre: number;
  config: PhaseDefinitionData;
  nom?: string;
  statut: string;
  tours: TourData[];
  classement: ClassementData | null;
}

export interface EquipeData {
  id: string;
  joueurIds: string[];
  clubId: string;
  nom: string;
  numero: number | null;
}

export interface InscriptionData {
  id: string;
  concoursId: string;
  equipe: EquipeData;
  horodatage: string;
  statut: string;
  teteDeSerie: boolean;
}

export interface TerrainData {
  id: string;
  concoursId: string;
  numero: number;
  nom: string;
  disponible: boolean;
  type: string;
}

export interface ConcoursData {
  id: string;
  nom: string;
  dateDebut: string;
  dateFin: string;
  lieu: string;
  organisateurId: string;
  statut: string;
  // FormuleConcours
  formule: {
    typeEquipe: string;
    phases: PhaseDefinitionData[];
    nbEquipesMin: number;
    nbEquipesMax: number;
  };
  // ReglementConcours
  reglement: {
    scoreVictoire: number;
    dureeMaxMinutes: number | null;
    pointsVictoire: number;
    pointsNul: number;
    pointsDefaite: number;
    nulAutorise: boolean;
    protectionClub: boolean;
    protectionJoueurs: boolean;
    tetesDeSerieActives: boolean;
    methodeAppariement: string;
    criteresClassement: string[];
    scoreForfaitGagnant: number;
    scoreForfaitPerdant: number;
    forfaitEliminatoire: boolean;
    pauseEntreMatchsMinutes: number;
    rotationTerrains: boolean;
  };
  terrains: TerrainData[];
  phases: PhaseData[];
  inscriptions: InscriptionData[];
}
