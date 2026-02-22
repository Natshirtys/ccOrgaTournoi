import { Entity, EntityId, InvariantViolationError, InvalidStateTransitionError } from '../../../shared/types.js';
import { StatutTour } from '../../shared/enums.js';
import { Match } from './match.js';

export class Tour extends Entity {
  private _statut: StatutTour;
  private _matchs: Match[];

  constructor(
    id: EntityId,
    public readonly phaseId: EntityId,
    public readonly numero: number,
    statut: StatutTour = StatutTour.EN_ATTENTE,
    matchs: Match[] = [],
  ) {
    super(id);
    this._statut = statut;
    this._matchs = matchs;
  }

  get statut(): StatutTour {
    return this._statut;
  }

  get matchs(): readonly Match[] {
    return this._matchs;
  }

  ajouterMatch(match: Match): void {
    if (this._statut !== StatutTour.EN_ATTENTE) {
      throw new InvariantViolationError('Impossible d\'ajouter un match à un tour déjà démarré');
    }
    this._matchs.push(match);
  }

  demarrer(): void {
    if (this._statut !== StatutTour.EN_ATTENTE) {
      throw new InvalidStateTransitionError(this._statut, StatutTour.EN_COURS, 'Tour');
    }
    if (this._matchs.length === 0) {
      throw new InvariantViolationError('Impossible de démarrer un tour sans matchs');
    }
    this._statut = StatutTour.EN_COURS;
  }

  terminer(): void {
    if (this._statut !== StatutTour.EN_COURS) {
      throw new InvalidStateTransitionError(this._statut, StatutTour.TERMINE, 'Tour');
    }
    const tousTermines = this._matchs.every(m => m.isTermine);
    if (!tousTermines) {
      throw new InvariantViolationError('Tous les matchs doivent être terminés pour clôturer le tour');
    }
    this._statut = StatutTour.TERMINE;
  }

  trouverMatch(matchId: EntityId): Match | undefined {
    return this._matchs.find(m => m.id === matchId);
  }

  get tousMatchsTermines(): boolean {
    return this._matchs.every(m => m.isTermine);
  }
}
