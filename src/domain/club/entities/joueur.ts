import { Entity, EntityId } from '../../../shared/types.js';
import { LicenceNumber } from '../../shared/value-objects.js';

export class Joueur extends Entity {
  constructor(
    id: EntityId,
    public readonly nom: string,
    public readonly prenom: string,
    public readonly licence: LicenceNumber | null,
    public readonly clubId: EntityId,
    public readonly categorie: string,
    public readonly classement: number | null,
    private _actif: boolean = true,
  ) {
    super(id);
  }

  get actif(): boolean {
    return this._actif;
  }

  get nomComplet(): string {
    return `${this.prenom} ${this.nom}`;
  }

  desactiver(): void {
    this._actif = false;
  }

  activer(): void {
    this._actif = true;
  }
}
