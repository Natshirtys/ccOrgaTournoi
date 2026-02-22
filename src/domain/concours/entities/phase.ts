import { Entity, EntityId, InvalidStateTransitionError } from '../../../shared/types.js';
import { StatutPhase, TypePhase } from '../../shared/enums.js';
import { PhaseDefinition } from '../../shared/value-objects.js';
import { Tour } from './tour.js';
import { Classement } from './classement.js';

export class Phase extends Entity {
  private _statut: StatutPhase;
  private _tours: Tour[];
  private _classement: Classement | null;

  constructor(
    id: EntityId,
    public readonly concoursId: EntityId,
    public readonly type: TypePhase,
    public readonly ordre: number,
    public readonly config: PhaseDefinition,
    statut: StatutPhase = StatutPhase.EN_ATTENTE,
    tours: Tour[] = [],
    classement: Classement | null = null,
  ) {
    super(id);
    this._statut = statut;
    this._tours = tours;
    this._classement = classement;
  }

  get statut(): StatutPhase {
    return this._statut;
  }

  get tours(): readonly Tour[] {
    return this._tours;
  }

  get classement(): Classement | null {
    return this._classement;
  }

  ajouterTour(tour: Tour): void {
    this._tours.push(tour);
  }

  demarrer(): void {
    if (this._statut !== StatutPhase.EN_ATTENTE) {
      throw new InvalidStateTransitionError(this._statut, StatutPhase.EN_COURS, 'Phase');
    }
    this._statut = StatutPhase.EN_COURS;
  }

  terminer(): void {
    if (this._statut !== StatutPhase.EN_COURS) {
      throw new InvalidStateTransitionError(this._statut, StatutPhase.TERMINEE, 'Phase');
    }
    this._statut = StatutPhase.TERMINEE;
  }

  mettreAJourClassement(classement: Classement): void {
    this._classement = classement;
  }

  trouverTour(tourId: EntityId): Tour | undefined {
    return this._tours.find(t => t.id === tourId);
  }

  get dernierTour(): Tour | undefined {
    return this._tours[this._tours.length - 1];
  }
}
