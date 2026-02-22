import { Entity, EntityId } from '../../../shared/types.js';

export class Terrain extends Entity {
  constructor(
    id: EntityId,
    public readonly concoursId: EntityId,
    public readonly numero: number,
    public readonly nom: string,
    private _disponible: boolean = true,
    public readonly type: string = 'standard',
  ) {
    super(id);
  }

  get disponible(): boolean {
    return this._disponible;
  }

  occuper(): void {
    this._disponible = false;
  }

  liberer(): void {
    this._disponible = true;
  }
}
