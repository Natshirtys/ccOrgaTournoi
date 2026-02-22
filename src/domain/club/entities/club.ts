import { AggregateRoot, EntityId } from '../../../shared/types.js';
import { Joueur } from './joueur.js';

export class Club extends AggregateRoot {
  private _joueurs: Joueur[] = [];

  constructor(
    id: EntityId,
    public readonly nom: string,
    public readonly numero: string,
    public readonly ville: string,
    public readonly district: string,
    public readonly region: string,
  ) {
    super(id);
  }

  get joueurs(): readonly Joueur[] {
    return this._joueurs;
  }

  ajouterJoueur(joueur: Joueur): void {
    if (joueur.clubId !== this.id) {
      throw new Error('Le joueur doit appartenir à ce club');
    }
    if (this._joueurs.some(j => j.id === joueur.id)) {
      throw new Error('Ce joueur est déjà dans le club');
    }
    this._joueurs.push(joueur);
  }

  retirerJoueur(joueurId: EntityId): void {
    this._joueurs = this._joueurs.filter(j => j.id !== joueurId);
  }

  trouverJoueur(joueurId: EntityId): Joueur | undefined {
    return this._joueurs.find(j => j.id === joueurId);
  }
}
