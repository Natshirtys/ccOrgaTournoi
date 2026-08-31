import { Entity, EntityId, InvariantViolationError } from '../../../shared/types.js';
import { PosteMelee } from '../../shared/enums.js';

export class ParticipantMelee extends Entity {
  private _nom: string;
  private _poste: PosteMelee;
  private _actif: boolean;

  constructor(
    id: EntityId,
    public readonly concoursId: EntityId,
    nom: string,
    poste: PosteMelee,
    actif = true,
  ) {
    super(id);
    this._nom = nom.trim();
    this._poste = poste;
    this._actif = actif;
    if (!this._nom) throw new InvariantViolationError('Le nom du participant est requis');
  }

  get nom(): string { return this._nom; }
  get poste(): PosteMelee { return this._poste; }
  get actif(): boolean { return this._actif; }

  modifier(nom: string, poste: PosteMelee): void {
    const valeur = nom.trim();
    if (!valeur) throw new InvariantViolationError('Le nom du participant est requis');
    this._nom = valeur;
    this._poste = poste;
  }

  definirActif(actif: boolean): void { this._actif = actif; }
}
