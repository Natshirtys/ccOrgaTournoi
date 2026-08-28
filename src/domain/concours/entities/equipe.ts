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
    if (!nom.trim()) {
      throw new InvariantViolationError("Le nom de l'équipe est requis");
    }
  }

  validateComposition(typeEquipe: TypeEquipe): void {
    if (this.joueurIds.length === 0) return;
    const attendu = JOUEURS_PAR_TYPE[typeEquipe];
    const joueursNormalises = this.joueurIds.map((id) => id.trim().toLocaleLowerCase('fr-FR'));
    if (new Set(joueursNormalises).size !== joueursNormalises.length) {
      throw new InvariantViolationError('Un joueur ne peut pas apparaître plusieurs fois dans la même équipe');
    }
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
