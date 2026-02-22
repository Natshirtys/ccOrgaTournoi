import { Entity, EntityId } from '../../../shared/types.js';
import { StatutInscription } from '../../shared/enums.js';
import { Equipe } from './equipe.js';

export class Inscription extends Entity {
  constructor(
    id: EntityId,
    public readonly concoursId: EntityId,
    public readonly equipe: Equipe,
    public readonly horodatage: Date,
    private _statut: StatutInscription = StatutInscription.CONFIRMEE,
    public readonly teteDeSerie: boolean = false,
  ) {
    super(id);
  }

  get statut(): StatutInscription {
    return this._statut;
  }

  get equipeId(): EntityId {
    return this.equipe.id;
  }

  annuler(): void {
    this._statut = StatutInscription.ANNULEE;
  }

  estActive(): boolean {
    return this._statut === StatutInscription.CONFIRMEE;
  }
}
