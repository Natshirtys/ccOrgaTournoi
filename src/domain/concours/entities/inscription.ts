import { Entity, EntityId } from '../../../shared/types.js';
import { StatutInscription } from '../../shared/enums.js';
import { Equipe } from './equipe.js';

export class Inscription extends Entity {
  constructor(
    id: EntityId,
    public readonly concoursId: EntityId,
    private _equipe: Equipe,
    public readonly horodatage: Date,
    private _statut: StatutInscription = StatutInscription.CONFIRMEE,
    private _teteDeSerie: boolean = false,
  ) {
    super(id);
  }

  get statut(): StatutInscription {
    return this._statut;
  }

  get equipeId(): EntityId {
    return this._equipe.id;
  }

  get equipe(): Equipe {
    return this._equipe;
  }

  get teteDeSerie(): boolean {
    return this._teteDeSerie;
  }

  modifier(equipe: Equipe, teteDeSerie: boolean): void {
    this._equipe = equipe;
    this._teteDeSerie = teteDeSerie;
  }

  annuler(): void {
    this._statut = StatutInscription.ANNULEE;
  }

  estActive(): boolean {
    return this._statut === StatutInscription.CONFIRMEE;
  }
}
