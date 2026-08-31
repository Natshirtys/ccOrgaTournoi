import { AggregateRoot, EntityId, InvalidStateTransitionError, InvariantViolationError } from '../../../shared/types.js';
import { StatutConcours, StatutMatch, TypePhase } from '../../shared/enums.js';
import { DateRange, FormuleConcours, ReglementConcours, ResultatMatch, Score } from '../../shared/value-objects.js';
import { Terrain } from './terrain.js';
import { Phase } from './phase.js';
import { Inscription } from './inscription.js';
import { Equipe } from './equipe.js';
import { ParticipantMelee } from './participant-melee.js';

export type TypeActionAnnulable =
  | 'DEMARRAGE_MATCH'
  | 'SCORE'
  | 'FORFAIT'
  | 'TERRAIN'
  | 'CORRECTION_SCORE';

export interface EtatMatchAnnulable {
  matchId: EntityId;
  statut: StatutMatch;
  score: Score | null;
  resultat: ResultatMatch | null;
  terrainId: EntityId | null;
  horaire: Date | null;
}

export interface EtatTerrainAnnulable {
  terrainId: EntityId;
  actif: boolean;
  occupe: boolean;
}

export interface ActionAnnulable {
  type: TypeActionAnnulable;
  libelle: string;
  creeLe: Date;
  signatureApres: string;
  matchs: EtatMatchAnnulable[];
  terrains: EtatTerrainAnnulable[];
}

const TRANSITIONS_CONCOURS: Record<StatutConcours, StatutConcours[]> = {
  [StatutConcours.BROUILLON]: [StatutConcours.INSCRIPTIONS_OUVERTES],
  [StatutConcours.INSCRIPTIONS_OUVERTES]: [StatutConcours.INSCRIPTIONS_CLOSES],
  [StatutConcours.INSCRIPTIONS_CLOSES]: [StatutConcours.TIRAGE_EN_COURS, StatutConcours.INSCRIPTIONS_OUVERTES],
  [StatutConcours.TIRAGE_EN_COURS]: [StatutConcours.EN_COURS, StatutConcours.INSCRIPTIONS_CLOSES],
  [StatutConcours.EN_COURS]: [StatutConcours.TERMINE],
  [StatutConcours.TERMINE]: [StatutConcours.ARCHIVE],
  [StatutConcours.ARCHIVE]: [],
};

export class Concours extends AggregateRoot {
  private _statut: StatutConcours;
  private _terrains: Terrain[];
  private _phases: Phase[];
  private _inscriptions: Inscription[];
  private _estPublic: boolean;
  private _derniereActionAnnulable: ActionAnnulable | null;
  private _participantsMelee: ParticipantMelee[];

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
    estPublic?: boolean,
    derniereActionAnnulable: ActionAnnulable | null = null,
    participantsMelee: ParticipantMelee[] = [],
  ) {
    super(id);
    this._statut = statut;
    this._terrains = terrains;
    this._phases = phases;
    this._inscriptions = inscriptions;
    // Rétrocompatibilité : les concours existants restent visibles, sauf les archives.
    this._estPublic = estPublic ?? statut !== StatutConcours.ARCHIVE;
    this._derniereActionAnnulable = derniereActionAnnulable;
    this._participantsMelee = participantsMelee;
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

  get participantsMelee(): readonly ParticipantMelee[] { return this._participantsMelee; }
  get participantsMeleeActifs(): ParticipantMelee[] { return this._participantsMelee.filter((p) => p.actif); }
  get estMelee(): boolean {
    const type = this.formule.phases[0]?.type;
    return type === TypePhase.MELEE || type === TypePhase.MELEE_TOURNANTE;
  }

  get nbEquipesInscrites(): number {
    return this.inscriptionsActives.length;
  }

  get estPublic(): boolean {
    return this._estPublic;
  }

  get derniereActionAnnulable(): ActionAnnulable | null {
    if (!this._derniereActionAnnulable) return null;
    return this._derniereActionAnnulable.signatureApres === this.calculerSignatureEtat()
      ? this._derniereActionAnnulable
      : null;
  }

  capturerActionAnnulable(type: TypeActionAnnulable, libelle: string): ActionAnnulable {
    return {
      type,
      libelle,
      creeLe: new Date(),
      signatureApres: '',
      matchs: this._phases.flatMap((phase) =>
        phase.tours.flatMap((tour) =>
          tour.matchs.map((match) => ({
            matchId: match.id,
            statut: match.statut,
            score: match.score,
            resultat: match.resultat,
            terrainId: match.terrainId,
            horaire: match.horaire,
          })),
        ),
      ),
      terrains: this._terrains.map((terrain) => ({
        terrainId: terrain.id,
        actif: terrain.actif,
        occupe: terrain.occupe,
      })),
    };
  }

  enregistrerActionAnnulable(action: ActionAnnulable): void {
    this._derniereActionAnnulable = {
      ...action,
      signatureApres: this.calculerSignatureEtat(),
    };
  }

  annulerDerniereAction(): string {
    this.verifierNonArchive();
    const action = this.derniereActionAnnulable;
    if (!action) {
      throw new InvariantViolationError('Aucune action récente ne peut être annulée');
    }

    const matchs = new Map(
      this._phases.flatMap((phase) =>
        phase.tours.flatMap((tour) => tour.matchs.map((match) => [match.id, match] as const)),
      ),
    );
    for (const etat of action.matchs) {
      const match = matchs.get(etat.matchId);
      if (!match) {
        throw new InvariantViolationError('Le concours a trop évolué pour annuler cette action');
      }
      match.restaurerEtat(
        etat.statut,
        etat.score,
        etat.resultat,
        etat.terrainId,
        etat.horaire,
      );
    }

    const terrains = new Map(this._terrains.map((terrain) => [terrain.id, terrain] as const));
    for (const etat of action.terrains) {
      const terrain = terrains.get(etat.terrainId);
      if (!terrain) {
        throw new InvariantViolationError('Le concours a trop évolué pour annuler cette action');
      }
      terrain.restaurerEtat(etat.actif, etat.occupe);
    }

    this._derniereActionAnnulable = null;
    return action.libelle;
  }

  definirVisibilite(estPublic: boolean): void {
    this._estPublic = estPublic;
  }

  // --- Gestion des terrains ---

  ajouterTerrain(terrain: Terrain): void {
    this.verifierNonArchive();
    if (this._terrains.some(t => t.numero === terrain.numero)) {
      throw new InvariantViolationError(`Le terrain numéro ${terrain.numero} existe déjà`);
    }
    this._terrains.push(terrain);
  }

  definirDisponibiliteTerrain(terrainId: EntityId, actif: boolean): void {
    this.verifierNonArchive();
    const terrain = this._terrains.find(t => t.id === terrainId);
    if (!terrain) {
      throw new InvariantViolationError('Terrain non trouvé');
    }
    if (actif) terrain.remettreEnService();
    else terrain.mettreHorsService();
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
    if (!this.estMelee && this.nbEquipesInscrites < this.formule.nbEquipesMin) {
      throw new InvariantViolationError(
        `Pas assez d'équipes inscrites (${this.nbEquipesInscrites}/${this.formule.nbEquipesMin} minimum)`,
      );
    }
    if (this.estMelee && this.participantsMeleeActifs.length < this.formule.joueurParEquipe * 2) {
      throw new InvariantViolationError('Il faut au moins deux équipes complètes pour lancer la mêlée');
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
    const estFormuleChampionnat = this.formule.phases[0]?.type === TypePhase.CHAMPIONNAT;
    const phasesPertinentes = estFormuleChampionnat
      ? this._phases.filter(p => p.type !== TypePhase.CONSOLANTE)
      : this._phases;
    const matchsNonTermines = phasesPertinentes.flatMap(p =>
      p.tours.flatMap(t => t.matchs.filter(m => !m.isTermine)),
    );

    if (matchsNonTermines.length > 0) {
      const statuts = new Map<string, number>();
      for (const match of matchsNonTermines) {
        statuts.set(match.statut, (statuts.get(match.statut) ?? 0) + 1);
      }
      const detailStatuts = [...statuts.entries()]
        .map(([statut, total]) => `${statut} : ${total}`)
        .join(', ');
      throw new InvariantViolationError(
        `Impossible de terminer : ${matchsNonTermines.length} match(s) non terminé(s) (${detailStatuts})`,
      );
    }

    this.transitionVers(StatutConcours.TERMINE);

    // Nettoyage rétroactif des consolantes créées à tort par les anciennes
    // versions pour les phases Championnat A/B/C.
    if (estFormuleChampionnat) {
      this._phases = phasesPertinentes;
    }
  }

  archiver(): void {
    this.transitionVers(StatutConcours.ARCHIVE);
    this._estPublic = false;
  }

  // --- Inscriptions ---

  inscrireParticipantMelee(participant: ParticipantMelee): void {
    this.verifierInscriptionsOuvertes();
    if (!this.estMelee) throw new InvariantViolationError("Ce concours n'est pas une mêlée");
    this.verifierNomParticipant(participant.nom);
    this._participantsMelee.push(participant);
  }

  modifierParticipantMelee(id: EntityId, nom: string, poste: import('../../shared/enums.js').PosteMelee): void {
    this.verifierInscriptionsOuvertes();
    const participant = this._participantsMelee.find((p) => p.id === id);
    if (!participant) throw new InvariantViolationError('Participant non trouvé');
    this.verifierNomParticipant(nom, id);
    participant.modifier(nom, poste);
  }

  definirParticipantMeleeActif(id: EntityId, actif: boolean): void {
    this.verifierNonArchive();
    if (![StatutConcours.INSCRIPTIONS_OUVERTES, StatutConcours.EN_COURS].includes(this._statut)) {
      throw new InvariantViolationError("La disponibilité ne peut être modifiée qu'entre deux parties");
    }
    if (this._statut === StatutConcours.EN_COURS) {
      if (this.formule.phases[0]?.type === TypePhase.MELEE) {
        throw new InvariantViolationError("Les équipes de la mêlée classique restent fixes pendant le concours");
      }
      const dernierTour = this._phases.find((p) => p.statut === 'EN_COURS')?.dernierTour;
      if (dernierTour && !dernierTour.tousMatchsTermines) {
        throw new InvariantViolationError('Terminez la partie en cours avant de modifier les disponibilités');
      }
    }
    const participant = this._participantsMelee.find((p) => p.id === id);
    if (!participant) throw new InvariantViolationError('Participant non trouvé');
    participant.definirActif(actif);
  }

  supprimerParticipantMelee(id: EntityId): void {
    this.verifierInscriptionsOuvertes();
    const index = this._participantsMelee.findIndex((p) => p.id === id);
    if (index < 0) throw new InvariantViolationError('Participant non trouvé');
    this._participantsMelee.splice(index, 1);
  }

  inscrireEquipe(inscription: Inscription): void {
    this.verifierInscriptionsOuvertes();
    if (this.nbEquipesInscrites >= this.formule.nbEquipesMax) {
      throw new InvariantViolationError('Nombre maximum d\'équipes atteint');
    }
    this.verifierEquipe(inscription.equipe);
    this._inscriptions.push(inscription);
  }

  modifierInscription(inscriptionId: EntityId, equipe: Equipe, teteDeSerie: boolean): void {
    this.verifierInscriptionsOuvertes();
    const inscription = this._inscriptions.find((i) => i.id === inscriptionId && i.estActive());
    if (!inscription) {
      throw new InvariantViolationError('Inscription active non trouvée');
    }
    this.verifierEquipe(equipe, inscriptionId);
    inscription.modifier(equipe, teteDeSerie);
  }

  annulerInscription(inscriptionId: EntityId): void {
    this.verifierInscriptionsOuvertes();
    const inscription = this._inscriptions.find(i => i.id === inscriptionId && i.estActive());
    if (!inscription) {
      throw new InvariantViolationError('Inscription active non trouvée');
    }
    inscription.annuler();
  }

  // --- Phases ---

  ajouterPhase(phase: Phase): void {
    this._phases.push(phase);
  }

  // --- Validations privées ---

  private verifierEquipe(equipe: Equipe, inscriptionIdIgnore?: EntityId): void {
    const nomNormalise = equipe.nom.trim().toLocaleLowerCase('fr-FR');
    const nomDejaUtilise = this.inscriptionsActives.some(
      (insc) => insc.id !== inscriptionIdIgnore
        && insc.equipe.nom.trim().toLocaleLowerCase('fr-FR') === nomNormalise,
    );
    if (nomDejaUtilise) {
      throw new InvariantViolationError(`Une équipe nommée « ${equipe.nom.trim()} » est déjà inscrite`);
    }

    if (equipe.joueurIds.length === 0) return;
    equipe.validateComposition(this.formule.typeEquipe);

    const joueursInscrits = new Set<EntityId>();
    for (const insc of this.inscriptionsActives) {
      if (insc.id === inscriptionIdIgnore) continue;
      for (const jId of insc.equipe.joueurIds) {
        joueursInscrits.add(jId.trim().toLocaleLowerCase('fr-FR'));
      }
    }
    for (const jId of equipe.joueurIds) {
      if (joueursInscrits.has(jId.trim().toLocaleLowerCase('fr-FR'))) {
        throw new InvariantViolationError(
          `Le joueur ${jId} est déjà inscrit dans une autre équipe de ce concours`,
        );
      }
    }
  }

  private verifierNomParticipant(nom: string, idIgnore?: EntityId): void {
    const normalise = nom.trim().toLocaleLowerCase('fr-FR');
    if (this._participantsMelee.some((p) => p.id !== idIgnore && p.nom.toLocaleLowerCase('fr-FR') === normalise)) {
      throw new InvariantViolationError(`Le participant « ${nom.trim()} » est déjà inscrit`);
    }
  }

  private calculerSignatureEtat(): string {
    const etat = JSON.stringify({
      statut: this._statut,
      estPublic: this._estPublic,
      terrains: this._terrains.map((terrain) => ({
        id: terrain.id,
        actif: terrain.actif,
        occupe: terrain.occupe,
      })),
      inscriptions: this._inscriptions.map((inscription) => ({
        id: inscription.id,
        statut: inscription.statut,
        equipeId: inscription.equipe.id,
        nom: inscription.equipe.nom,
        joueurs: inscription.equipe.joueurIds,
        club: inscription.equipe.clubId,
        teteDeSerie: inscription.teteDeSerie,
      })),
      participantsMelee: this._participantsMelee.map((participant) => ({
        id: participant.id, nom: participant.nom, poste: participant.poste, actif: participant.actif,
      })),
      phases: this._phases.map((phase) => ({
        id: phase.id,
        statut: phase.statut,
        tours: phase.tours.map((tour) => ({
          id: tour.id,
          statut: tour.statut,
          matchs: tour.matchs.map((match) => ({
            id: match.id,
            statut: match.statut,
            terrainId: match.terrainId,
            horaire: match.horaire?.toISOString() ?? null,
            score: match.score
              ? [match.score.pointsA, match.score.pointsB]
              : null,
            resultat: match.resultat
              ? [
                  match.resultat.vainqueur,
                  match.resultat.type,
                  match.resultat.pointsAttribuesA,
                  match.resultat.pointsAttribuesB,
                ]
              : null,
          })),
        })),
      })),
    });

    let hashA = 2166136261;
    let hashB = 5381;
    for (let index = 0; index < etat.length; index++) {
      const code = etat.charCodeAt(index);
      hashA ^= code;
      hashA = Math.imul(hashA, 16777619);
      hashB = Math.imul(hashB, 33) ^ code;
    }
    return `${etat.length}:${hashA >>> 0}:${hashB >>> 0}`;
  }

  private verifierInscriptionsOuvertes(): void {
    if (this._statut !== StatutConcours.INSCRIPTIONS_OUVERTES) {
      throw new InvariantViolationError('Les inscriptions ne sont pas ouvertes');
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
