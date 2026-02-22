import { EntityId } from '../../../shared/types.js';
import { Club } from '../entities/club.js';
import { Joueur } from '../entities/joueur.js';

export interface ClubRepository {
  findById(id: EntityId): Promise<Club | null>;
  save(club: Club): Promise<void>;
  findAll(): Promise<Club[]>;
  nextId(): EntityId;
}

export interface JoueurRepository {
  findById(id: EntityId): Promise<Joueur | null>;
  findByClub(clubId: EntityId): Promise<Joueur[]>;
  findByLicence(numero: string): Promise<Joueur | null>;
  save(joueur: Joueur): Promise<void>;
  nextId(): EntityId;
}
