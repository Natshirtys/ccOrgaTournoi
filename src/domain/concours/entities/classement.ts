import { EntityId } from '../../../shared/types.js';
import { CritereClassement } from '../../shared/enums.js';
import { GoalAverage } from '../../shared/value-objects.js';

export interface LigneClassement {
  equipeId: EntityId;
  rang: number;
  points: number;
  matchsJoues: number;
  matchsGagnes: number;
  matchsPerdus: number;
  matchsNuls: number;
  pointsMarques: number;
  pointsEncaisses: number;
  goalAverage: GoalAverage;
  qualifiee: boolean;
}

export class Classement {
  constructor(
    public readonly phaseId: EntityId,
    private _lignes: LigneClassement[],
    public readonly criteres: CritereClassement[],
  ) {}

  get lignes(): readonly LigneClassement[] {
    return this._lignes;
  }

  mettreAJour(lignes: LigneClassement[]): void {
    this._lignes = lignes;
  }

  getLigne(equipeId: EntityId): LigneClassement | undefined {
    return this._lignes.find(l => l.equipeId === equipeId);
  }

  getQualifiees(): LigneClassement[] {
    return this._lignes.filter(l => l.qualifiee);
  }

  getRang(equipeId: EntityId): number | undefined {
    return this._lignes.find(l => l.equipeId === equipeId)?.rang;
  }
}
