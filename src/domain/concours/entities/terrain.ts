import { Entity, EntityId } from '../../../shared/types.js';

export class Terrain extends Entity {
  private _actif: boolean;
  private _occupe: boolean;

  constructor(
    id: EntityId,
    public readonly concoursId: EntityId,
    public readonly numero: number,
    public readonly nom: string,
    disponible: boolean = true,
    public readonly type: string = 'standard',
    actif?: boolean,
    occupe?: boolean,
  ) {
    super(id);
    this._actif = actif ?? true;
    this._occupe = occupe ?? !disponible;
  }

  get disponible(): boolean {
    return this._actif && !this._occupe;
  }

  get actif(): boolean {
    return this._actif;
  }

  get occupe(): boolean {
    return this._occupe;
  }

  occuper(): void {
    this._occupe = true;
  }

  liberer(): void {
    this._occupe = false;
  }

  mettreHorsService(): void {
    this._actif = false;
  }

  remettreEnService(): void {
    this._actif = true;
  }

  restaurerEtat(actif: boolean, occupe: boolean): void {
    this._actif = actif;
    this._occupe = occupe;
  }
}
