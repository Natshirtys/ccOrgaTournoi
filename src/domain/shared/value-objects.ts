import { ValueObject, InvariantViolationError } from '../../shared/types.js';
import {
  TypeEquipe,
  TypePhase,
  CritereClassement,
  MethodeAppariement,
  TypeResultat,
  TypeQualification,
  JOUEURS_PAR_TYPE,
} from './enums.js';

// --- Score ---

export class Score extends ValueObject {
  constructor(
    public readonly pointsA: number,
    public readonly pointsB: number,
  ) {
    super();
    if (!Number.isInteger(pointsA) || pointsA < 0) {
      throw new InvariantViolationError('pointsA doit être un entier positif ou nul');
    }
    if (!Number.isInteger(pointsB) || pointsB < 0) {
      throw new InvariantViolationError('pointsB doit être un entier positif ou nul');
    }
  }

  isValid(): boolean {
    return this.pointsA >= 0 && this.pointsB >= 0;
  }

  equals(other: ValueObject): boolean {
    if (!(other instanceof Score)) return false;
    return this.pointsA === other.pointsA && this.pointsB === other.pointsB;
  }
}

// --- GoalAverage ---

export class GoalAverage extends ValueObject {
  public readonly difference: number;
  public readonly quotient: number;

  constructor(
    public readonly pointsMarques: number,
    public readonly pointsEncaisses: number,
  ) {
    super();
    this.difference = pointsMarques - pointsEncaisses;
    this.quotient = pointsEncaisses === 0 ? Infinity : pointsMarques / pointsEncaisses;
  }

  equals(other: ValueObject): boolean {
    if (!(other instanceof GoalAverage)) return false;
    return this.pointsMarques === other.pointsMarques && this.pointsEncaisses === other.pointsEncaisses;
  }
}

// --- DateRange ---

export class DateRange extends ValueObject {
  constructor(
    public readonly debut: Date,
    public readonly fin: Date,
  ) {
    super();
    if (debut > fin) {
      throw new InvariantViolationError('La date de début doit être antérieure ou égale à la date de fin');
    }
  }

  contains(date: Date): boolean {
    return date >= this.debut && date <= this.fin;
  }

  overlaps(other: DateRange): boolean {
    return this.debut <= other.fin && other.debut <= this.fin;
  }

  equals(other: ValueObject): boolean {
    if (!(other instanceof DateRange)) return false;
    return this.debut.getTime() === other.debut.getTime() && this.fin.getTime() === other.fin.getTime();
  }
}

// --- LicenceNumber ---

export class LicenceNumber extends ValueObject {
  constructor(
    public readonly numero: string,
    public readonly type: string,
    public readonly saison: string,
  ) {
    super();
    if (!numero || numero.trim() === '') {
      throw new InvariantViolationError('Le numéro de licence ne peut pas être vide');
    }
  }

  equals(other: ValueObject): boolean {
    if (!(other instanceof LicenceNumber)) return false;
    return this.numero === other.numero && this.saison === other.saison;
  }
}

// --- QualificationRule ---

export class QualificationRule extends ValueObject {
  constructor(
    public readonly type: TypeQualification,
    public readonly nombre: number,
    public readonly critere: CritereClassement = CritereClassement.POINTS,
  ) {
    super();
    if (nombre < 1) {
      throw new InvariantViolationError('Le nombre de qualifiés doit être au moins 1');
    }
  }

  equals(other: ValueObject): boolean {
    if (!(other instanceof QualificationRule)) return false;
    return this.type === other.type && this.nombre === other.nombre && this.critere === other.critere;
  }
}

// --- PhaseDefinition ---

export class PhaseDefinition extends ValueObject {
  constructor(
    public readonly type: TypePhase,
    public readonly drawStrategy: string,
    public readonly rankingCriteria: CritereClassement[],
    public readonly tiebreakChain: CritereClassement[],
    public readonly qualificationRule: QualificationRule | null,
    public readonly constraints: PhaseConstraints = {},
  ) {
    super();
  }

  equals(other: ValueObject): boolean {
    if (!(other instanceof PhaseDefinition)) return false;
    return this.type === other.type && this.drawStrategy === other.drawStrategy;
  }
}

export interface PhaseConstraints {
  protectionClub?: boolean;
  tetesDeSerieCount?: number;
  nulAutorise?: boolean;
  nbPoules?: number;
  taillePoule?: number;
}

// --- FormuleConcours ---

export class FormuleConcours extends ValueObject {
  constructor(
    public readonly typeEquipe: TypeEquipe,
    public readonly phases: PhaseDefinition[],
    public readonly nbEquipesMin: number,
    public readonly nbEquipesMax: number,
  ) {
    super();
    if (phases.length === 0) {
      throw new InvariantViolationError('Une formule doit contenir au moins une phase');
    }
    if (nbEquipesMin < 2) {
      throw new InvariantViolationError('Il faut au minimum 2 équipes');
    }
    if (nbEquipesMax < nbEquipesMin) {
      throw new InvariantViolationError('nbEquipesMax doit être >= nbEquipesMin');
    }
  }

  get joueurParEquipe(): number {
    return JOUEURS_PAR_TYPE[this.typeEquipe];
  }

  equals(other: ValueObject): boolean {
    if (!(other instanceof FormuleConcours)) return false;
    return this.typeEquipe === other.typeEquipe && this.phases.length === other.phases.length;
  }
}

// --- RèglementConcours ---

export class ReglementConcours extends ValueObject {
  // Paramètres de jeu
  public readonly scoreVictoire: number;
  public readonly dureeMaxMinutes: number | null;
  public readonly pointsVictoire: number;
  public readonly pointsNul: number;
  public readonly pointsDefaite: number;
  public readonly nulAutorise: boolean;

  // Paramètres de tirage
  public readonly protectionClub: boolean;
  public readonly protectionJoueurs: boolean;
  public readonly tetesDeSerieActives: boolean;
  public readonly methodeAppariement: MethodeAppariement;

  // Paramètres de classement
  public readonly criteresClassement: CritereClassement[];

  // Paramètres de forfait
  public readonly scoreForfaitGagnant: number;
  public readonly scoreForfaitPerdant: number;
  public readonly forfaitEliminatoire: boolean;

  // Paramètres terrain
  public readonly pauseEntreMatchsMinutes: number;
  public readonly rotationTerrains: boolean;

  constructor(params: Partial<ReglementConcoursParams> = {}) {
    super();
    this.scoreVictoire = params.scoreVictoire ?? 13;
    this.dureeMaxMinutes = params.dureeMaxMinutes ?? null;
    this.pointsVictoire = params.pointsVictoire ?? 2;
    this.pointsNul = params.pointsNul ?? 1;
    this.pointsDefaite = params.pointsDefaite ?? 0;
    this.nulAutorise = params.nulAutorise ?? false;
    this.protectionClub = params.protectionClub ?? false;
    this.protectionJoueurs = params.protectionJoueurs ?? false;
    this.tetesDeSerieActives = params.tetesDeSerieActives ?? false;
    this.methodeAppariement = params.methodeAppariement ?? MethodeAppariement.ALEATOIRE;
    this.criteresClassement = params.criteresClassement ?? [
      CritereClassement.POINTS,
      CritereClassement.GOAL_AVERAGE_GENERAL,
      CritereClassement.POINTS_MARQUES,
    ];
    this.scoreForfaitGagnant = params.scoreForfaitGagnant ?? 13;
    this.scoreForfaitPerdant = params.scoreForfaitPerdant ?? 0;
    this.forfaitEliminatoire = params.forfaitEliminatoire ?? false;
    this.pauseEntreMatchsMinutes = params.pauseEntreMatchsMinutes ?? 5;
    this.rotationTerrains = params.rotationTerrains ?? false;
  }

  equals(other: ValueObject): boolean {
    if (!(other instanceof ReglementConcours)) return false;
    return this.scoreVictoire === other.scoreVictoire
      && this.pointsVictoire === other.pointsVictoire
      && this.nulAutorise === other.nulAutorise;
  }
}

export interface ReglementConcoursParams {
  scoreVictoire: number;
  dureeMaxMinutes: number | null;
  pointsVictoire: number;
  pointsNul: number;
  pointsDefaite: number;
  nulAutorise: boolean;
  protectionClub: boolean;
  protectionJoueurs: boolean;
  tetesDeSerieActives: boolean;
  methodeAppariement: MethodeAppariement;
  criteresClassement: CritereClassement[];
  scoreForfaitGagnant: number;
  scoreForfaitPerdant: number;
  forfaitEliminatoire: boolean;
  pauseEntreMatchsMinutes: number;
  rotationTerrains: boolean;
}

// --- ResultatMatch ---

export class ResultatMatch extends ValueObject {
  constructor(
    public readonly vainqueur: string | null,
    public readonly type: TypeResultat,
    public readonly score: Score,
    public readonly pointsAttribuesA: number,
    public readonly pointsAttribuesB: number,
  ) {
    super();
  }

  static victoire(vainqueurId: string, score: Score, pointsV: number, pointsD: number): ResultatMatch {
    const isAWinner = true; // sera déterminé par le contexte
    return new ResultatMatch(vainqueurId, TypeResultat.VICTOIRE, score, isAWinner ? pointsV : pointsD, isAWinner ? pointsD : pointsV);
  }

  static nul(score: Score, pointsN: number): ResultatMatch {
    return new ResultatMatch(null, TypeResultat.NUL, score, pointsN, pointsN);
  }

  static forfait(vainqueurId: string, scoreG: number, scoreP: number, pointsV: number, pointsD: number): ResultatMatch {
    return new ResultatMatch(vainqueurId, TypeResultat.FORFAIT, new Score(scoreG, scoreP), pointsV, pointsD);
  }

  static bye(): ResultatMatch {
    return new ResultatMatch(null, TypeResultat.BYE, new Score(0, 0), 0, 0);
  }

  equals(other: ValueObject): boolean {
    if (!(other instanceof ResultatMatch)) return false;
    return this.vainqueur === other.vainqueur && this.type === other.type && this.score.equals(other.score);
  }
}

// --- PlanificationTour ---

export class PlanificationTour extends ValueObject {
  constructor(
    public readonly assignations: AssignationMatch[],
    public readonly conflits: ConflitTerrain[],
  ) {
    super();
  }

  hasConflits(): boolean {
    return this.conflits.length > 0;
  }

  equals(other: ValueObject): boolean {
    if (!(other instanceof PlanificationTour)) return false;
    return this.assignations.length === other.assignations.length;
  }
}

export interface AssignationMatch {
  matchId: string;
  terrainId: string;
  horaire: Date | null;
}

export interface ConflitTerrain {
  terrainId: string;
  matchIds: string[];
  raison: string;
}
