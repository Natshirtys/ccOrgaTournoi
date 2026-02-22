import { Entity, EntityId, InvariantViolationError } from '../../../shared/types.js';
import { TypeEquipe, JOUEURS_PAR_TYPE } from '../../shared/enums.js';

export class Equipe extends Entity {
  constructor(
    id: EntityId,
    public readonly joueurIds: readonly EntityId[],
    public readonly clubId: EntityId,
    public readonly nom: string,
    public readonly numero: number | null = null,
  ) {
    super(id);
  }

  validateComposition(typeEquipe: TypeEquipe): void {
    const attendu = JOUEURS_PAR_TYPE[typeEquipe];
    if (this.joueurIds.length !== attendu) {
      throw new InvariantViolationError(
        `Une équipe de type ${typeEquipe} doit avoir exactement ${attendu} joueur(s), mais en a ${this.joueurIds.length}`,
      );
    }
  }

  contientJoueur(joueurId: EntityId): boolean {
    return this.joueurIds.includes(joueurId);
  }
}
