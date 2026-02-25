import { AggregateRoot, EntityId, InvalidStateTransitionError, InvariantViolationError } from '../../../shared/types.js';
import { StatutConcours } from '../../shared/enums.js';
import { DateRange, FormuleConcours, ReglementConcours } from '../../shared/value-objects.js';
import { Terrain } from './terrain.js';
import { Phase } from './phase.js';
import { Inscription } from './inscription.js';
import { Equipe } from './equipe.js';

const TRANSITIONS_CONCOURS: Record<StatutConcours, StatutConcours[]> = {
  [StatutConcours.BROUILLON]: [StatutConcours.INSCRIPTIONS_OUVERTES, StatutConcours.ANNULE],
  [StatutConcours.INSCRIPTIONS_OUVERTES]: [StatutConcours.INSCRIPTIONS_CLOSES, StatutConcours.ANNULE],
  [StatutConcours.INSCRIPTIONS_CLOSES]: [StatutConcours.TIRAGE_EN_COURS, StatutConcours.INSCRIPTIONS_OUVERTES, StatutConcours.ANNULE],
  [StatutConcours.TIRAGE_EN_COURS]: [StatutConcours.EN_COURS, StatutConcours.INSCRIPTIONS_CLOSES, StatutConcours.ANNULE],
  [StatutConcours.EN_COURS]: [StatutConcours.TERMINE, StatutConcours.ANNULE],
  [StatutConcours.TERMINE]: [StatutConcours.ARCHIVE, StatutConcours.ANNULE],
  [StatutConcours.ARCHIVE]: [],
  [StatutConcours.ANNULE]: [],
};

export class Concours extends AggregateRoot {
  private _statut: StatutConcours;
  private _terrains: Terrain[];
  private _phases: Phase[];
  private _inscriptions: Inscription[];

  constructor(
    id: EntityId,
    public readonly nom: string,
    public readonly dates: DateRange,
    public readonly lieu: string,
    public readonly organisateurId: EntityId,
    public readonly formule: FormuleConcours,
    public readonly reglement: ReglementConcours,
    statut: StatutConcours = StatutConcours.BROUILLON,
    terrains: Terrain[] = [],
    phases: Phase[] = [],
    inscriptions: Inscription[] = [],
  ) {
    super(id);
    this._statut = statut;
    this._terrains = terrains;
    this._phases = phases;
    this._inscriptions = inscriptions;
  }

  // --- Getters ---

  get statut(): StatutConcours {
    return this._statut;
  }

  get terrains(): readonly Terrain[] {
    return this._terrains;
  }

  get phases(): readonly Phase[] {
    return this._phases;
  }

  get inscriptions(): readonly Inscription[] {
    return this._inscriptions;
  }

  get inscriptionsActives(): Inscription[] {
    return this._inscriptions.filter(i => i.estActive());
  }

  get nbEquipesInscrites(): number {
    return this.inscriptionsActives.length;
  }

  // --- Gestion des terrains ---

  ajouterTerrain(terrain: Terrain): void {
    this.verifierNonArchive();
    if (this._terrains.some(t => t.numero === terrain.numero)) {
      throw new InvariantViolationError(`Le terrain numéro ${terrain.numero} existe déjà`);
    }
    this._terrains.push(terrain);
  }

  // --- Machine à états du concours ---

  ouvrirInscriptions(): void {
    this.transitionVers(StatutConcours.INSCRIPTIONS_OUVERTES);
  }

  cloturerInscriptions(): void {
    this.transitionVers(StatutConcours.INSCRIPTIONS_CLOSES);
  }

  rouvrirInscriptions(): void {
    this.transitionVers(StatutConcours.INSCRIPTIONS_OUVERTES);
  }

  lancerTirage(): void {
    if (this.nbEquipesInscrites < this.formule.nbEquipesMin) {
      throw new InvariantViolationError(
        `Pas assez d'équipes inscrites (${this.nbEquipesInscrites}/${this.formule.nbEquipesMin} minimum)`,
      );
    }
    this.transitionVers(StatutConcours.TIRAGE_EN_COURS);
  }

  validerTirage(): void {
    this.transitionVers(StatutConcours.EN_COURS);
  }

  annulerTirage(): void {
    this.transitionVers(StatutConcours.INSCRIPTIONS_CLOSES);
  }

  terminer(): void {
    const matchsEnCours = this._phases.some(p =>
      p.tours.some(t =>
        t.matchs.some(m => !m.isTermine),
      ),
    );
    if (matchsEnCours) {
      throw new InvariantViolationError('Impossible de terminer : des matchs sont encore en cours');
    }
    this.transitionVers(StatutConcours.TERMINE);
  }

  archiver(): void {
    this.transitionVers(StatutConcours.ARCHIVE);
  }

  annuler(): void {
    if (this._statut === StatutConcours.ARCHIVE) {
      throw new InvalidStateTransitionError(this._statut, StatutConcours.ANNULE, 'Concours');
    }
    this._statut = StatutConcours.ANNULE;
  }

  // --- Inscriptions ---

  inscrireEquipe(inscription: Inscription): void {
    if (this._statut !== StatutConcours.INSCRIPTIONS_OUVERTES) {
      throw new InvariantViolationError('Les inscriptions ne sont pas ouvertes');
    }
    if (this.nbEquipesInscrites >= this.formule.nbEquipesMax) {
      throw new InvariantViolationError('Nombre maximum d\'équipes atteint');
    }
    // Vérifier composition et doublons seulement si l'équipe a des joueurs
    if (inscription.equipe.joueurIds.length > 0) {
      this.verifierPasDeDoublonJoueur(inscription.equipe);
      inscription.equipe.validateComposition(this.formule.typeEquipe);
    }
    this._inscriptions.push(inscription);
  }

  annulerInscription(inscriptionId: EntityId): void {
    const inscription = this._inscriptions.find(i => i.id === inscriptionId);
    if (!inscription) {
      throw new InvariantViolationError('Inscription non trouvée');
    }
    inscription.annuler();
  }

  // --- Phases ---

  ajouterPhase(phase: Phase): void {
    this._phases.push(phase);
  }

  // --- Validations privées ---

  private verifierPasDeDoublonJoueur(equipe: Equipe): void {
    const joueursInscrits = new Set<EntityId>();
    for (const insc of this.inscriptionsActives) {
      for (const jId of insc.equipe.joueurIds) {
        joueursInscrits.add(jId);
      }
    }
    for (const jId of equipe.joueurIds) {
      if (joueursInscrits.has(jId)) {
        throw new InvariantViolationError(
          `Le joueur ${jId} est déjà inscrit dans une autre équipe de ce concours`,
        );
      }
    }
  }

  private verifierNonArchive(): void {
    if (this._statut === StatutConcours.ARCHIVE) {
      throw new InvariantViolationError('Un concours archivé est immuable');
    }
  }

  private transitionVers(nouveauStatut: StatutConcours): void {
    const transitionsPermises = TRANSITIONS_CONCOURS[this._statut];
    if (!transitionsPermises.includes(nouveauStatut)) {
      throw new InvalidStateTransitionError(this._statut, nouveauStatut, 'Concours');
    }
    this._statut = nouveauStatut;
  }
}
