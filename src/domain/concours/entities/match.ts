import { Entity, EntityId, InvalidStateTransitionError, InvariantViolationError } from '../../../shared/types.js';
import { StatutMatch } from '../../shared/enums.js';
import { Score, ResultatMatch } from '../../shared/value-objects.js';

const TRANSITIONS_MATCH: Record<StatutMatch, StatutMatch[]> = {
  [StatutMatch.PROGRAMME]: [StatutMatch.EN_COURS],
  [StatutMatch.EN_COURS]: [StatutMatch.SCORE_SAISI, StatutMatch.FORFAIT, StatutMatch.ABANDON],
  [StatutMatch.SCORE_SAISI]: [StatutMatch.TERMINE],
  [StatutMatch.TERMINE]: [StatutMatch.EN_CORRECTION],
  [StatutMatch.EN_CORRECTION]: [StatutMatch.TERMINE],
  [StatutMatch.FORFAIT]: [],
  [StatutMatch.ABANDON]: [],
  [StatutMatch.BYE]: [],
};

export class Match extends Entity {
  private _statut: StatutMatch;
  private _score: Score | null;
  private _resultat: ResultatMatch | null;

  constructor(
    id: EntityId,
    public readonly tourId: EntityId,
    public readonly equipeAId: EntityId,
    public readonly equipeBId: EntityId | null,
    private _terrainId: EntityId | null = null,
    private _horaire: Date | null = null,
    statut?: StatutMatch,
    score?: Score | null,
    resultat?: ResultatMatch | null,
  ) {
    super(id);
    // BYE automatique si pas d'adversaire
    this._statut = equipeBId === null ? StatutMatch.BYE : (statut ?? StatutMatch.PROGRAMME);
    this._score = score ?? null;
    this._resultat = resultat ?? null;
  }

  get statut(): StatutMatch {
    return this._statut;
  }

  get score(): Score | null {
    return this._score;
  }

  get resultat(): ResultatMatch | null {
    return this._resultat;
  }

  get terrainId(): EntityId | null {
    return this._terrainId;
  }

  get horaire(): Date | null {
    return this._horaire;
  }

  get isBye(): boolean {
    return this._statut === StatutMatch.BYE;
  }

  get isTermine(): boolean {
    return [StatutMatch.TERMINE, StatutMatch.FORFAIT, StatutMatch.ABANDON, StatutMatch.BYE].includes(this._statut);
  }

  assignerTerrain(terrainId: EntityId, horaire: Date | null = null): void {
    this._terrainId = terrainId;
    this._horaire = horaire;
  }

  demarrer(): void {
    this.transitionVers(StatutMatch.EN_COURS);
  }

  saisirScore(score: Score): void {
    if (this._statut !== StatutMatch.EN_COURS) {
      throw new InvariantViolationError('Le score ne peut être saisi que si le match est EN_COURS');
    }
    this._score = score;
    this.transitionVers(StatutMatch.SCORE_SAISI);
  }

  validerResultat(resultat: ResultatMatch): void {
    if (this._statut !== StatutMatch.SCORE_SAISI && this._statut !== StatutMatch.EN_CORRECTION) {
      throw new InvariantViolationError('Le résultat ne peut être validé que si le score est saisi ou en correction');
    }
    this._resultat = resultat;
    this.transitionVers(StatutMatch.TERMINE);
  }

  declarerForfait(equipeId: EntityId): void {
    if (equipeId !== this.equipeAId && equipeId !== this.equipeBId) {
      throw new InvariantViolationError("L'équipe ne participe pas à ce match");
    }
    this.transitionVers(StatutMatch.FORFAIT);
  }

  declarerAbandon(equipeId: EntityId): void {
    if (equipeId !== this.equipeAId && equipeId !== this.equipeBId) {
      throw new InvariantViolationError("L'équipe ne participe pas à ce match");
    }
    this.transitionVers(StatutMatch.ABANDON);
  }

  demanderCorrection(): void {
    this.transitionVers(StatutMatch.EN_CORRECTION);
  }

  corrigerScore(nouveauScore: Score, nouveauResultat: ResultatMatch): void {
    if (this._statut !== StatutMatch.EN_CORRECTION) {
      throw new InvariantViolationError('Le match doit être EN_CORRECTION pour corriger le score');
    }
    this._score = nouveauScore;
    this._resultat = nouveauResultat;
    this.transitionVers(StatutMatch.TERMINE);
  }

  private transitionVers(nouveauStatut: StatutMatch): void {
    const transitionsPermises = TRANSITIONS_MATCH[this._statut];
    if (!transitionsPermises.includes(nouveauStatut)) {
      throw new InvalidStateTransitionError(this._statut, nouveauStatut, 'Match');
    }
    this._statut = nouveauStatut;
  }
}
