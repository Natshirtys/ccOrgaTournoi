import { Concours } from '../../domain/concours/entities/concours.js';
import { Phase } from '../../domain/concours/entities/phase.js';
import { Tour } from '../../domain/concours/entities/tour.js';
import { Match } from '../../domain/concours/entities/match.js';
import { Terrain } from '../../domain/concours/entities/terrain.js';
import { Inscription } from '../../domain/concours/entities/inscription.js';
import { Equipe } from '../../domain/concours/entities/equipe.js';
import { Classement, LigneClassement } from '../../domain/concours/entities/classement.js';
import {
  DateRange,
  FormuleConcours,
  ReglementConcours,
  PhaseDefinition,
  QualificationRule,
  Score,
  ResultatMatch,
  GoalAverage,
} from '../../domain/shared/value-objects.js';
import {
  StatutConcours,
  StatutMatch,
  StatutPhase,
  StatutTour,
  StatutInscription,
  TypePhase,
  TypeEquipe,
  CritereClassement,
  MethodeAppariement,
  TypeResultat,
  TypeQualification,
} from '../../domain/shared/enums.js';
import {
  ConcoursData,
  PhaseData,
  TourData,
  MatchData,
  TerrainData,
  InscriptionData,
  EquipeData,
  ClassementData,
  LigneClassementData,
  PhaseDefinitionData,
  QualificationRuleData,
} from './types.js';

// ─── SERIALIZE ───────────────────────────────────────────────────────────────

function serializeQualificationRule(rule: QualificationRule): QualificationRuleData {
  return { type: rule.type, nombre: rule.nombre, critere: rule.critere };
}

function serializePhaseDefinition(def: PhaseDefinition): PhaseDefinitionData {
  return {
    type: def.type,
    drawStrategy: def.drawStrategy,
    rankingCriteria: def.rankingCriteria,
    tiebreakChain: def.tiebreakChain,
    qualificationRule: def.qualificationRule ? serializeQualificationRule(def.qualificationRule) : null,
    constraints: def.constraints,
  };
}

function serializeMatch(m: Match): MatchData {
  return {
    id: m.id,
    tourId: m.tourId,
    equipeAId: m.equipeAId,
    equipeBId: m.equipeBId,
    terrainId: m.terrainId,
    horaire: m.horaire ? m.horaire.toISOString() : null,
    statut: m.statut,
    score: m.score ? { pointsA: m.score.pointsA, pointsB: m.score.pointsB } : null,
    resultat: m.resultat ? {
      vainqueur: m.resultat.vainqueur,
      type: m.resultat.type,
      score: { pointsA: m.resultat.score.pointsA, pointsB: m.resultat.score.pointsB },
      pointsAttribuesA: m.resultat.pointsAttribuesA,
      pointsAttribuesB: m.resultat.pointsAttribuesB,
    } : null,
  };
}

function serializeTour(t: Tour): TourData {
  return {
    id: t.id,
    phaseId: t.phaseId,
    numero: t.numero,
    statut: t.statut,
    matchs: [...t.matchs].map(serializeMatch),
    ...(t.nom !== undefined ? { nom: t.nom } : {}),
  };
}

function serializeLigneClassement(l: LigneClassement): LigneClassementData {
  return {
    equipeId: l.equipeId,
    rang: l.rang,
    points: l.points,
    matchsJoues: l.matchsJoues,
    matchsGagnes: l.matchsGagnes,
    matchsPerdus: l.matchsPerdus,
    matchsNuls: l.matchsNuls,
    pointsMarques: l.pointsMarques,
    pointsEncaisses: l.pointsEncaisses,
    goalAverage: { pointsMarques: l.goalAverage.pointsMarques, pointsEncaisses: l.goalAverage.pointsEncaisses },
    qualifiee: l.qualifiee,
  };
}

function serializeClassement(c: Classement): ClassementData {
  return {
    phaseId: c.phaseId,
    lignes: [...c.lignes].map(serializeLigneClassement),
    criteres: c.criteres,
  };
}

function serializePhase(p: Phase): PhaseData {
  return {
    id: p.id,
    concoursId: p.concoursId,
    type: p.type,
    ordre: p.ordre,
    config: serializePhaseDefinition(p.config),
    ...(p.nom !== undefined ? { nom: p.nom } : {}),
    statut: p.statut,
    tours: [...p.tours].map(serializeTour),
    classement: p.classement ? serializeClassement(p.classement) : null,
  };
}

function serializeTerrain(t: Terrain): TerrainData {
  return {
    id: t.id,
    concoursId: t.concoursId,
    numero: t.numero,
    nom: t.nom,
    disponible: t.disponible,
    type: t.type,
  };
}

function serializeInscription(i: Inscription): InscriptionData {
  const eq = i.equipe;
  const equipeData: EquipeData = {
    id: eq.id,
    joueurIds: [...eq.joueurIds],
    clubId: eq.clubId,
    nom: eq.nom,
    numero: eq.numero,
  };
  return {
    id: i.id,
    concoursId: i.concoursId,
    equipe: equipeData,
    horodatage: i.horodatage.toISOString(),
    statut: i.statut,
    teteDeSerie: i.teteDeSerie,
  };
}

export function serialize(concours: Concours): ConcoursData {
  return {
    id: concours.id,
    nom: concours.nom,
    dateDebut: concours.dates.debut.toISOString(),
    dateFin: concours.dates.fin.toISOString(),
    lieu: concours.lieu,
    organisateurId: concours.organisateurId,
    statut: concours.statut,
    formule: {
      typeEquipe: concours.formule.typeEquipe,
      phases: concours.formule.phases.map(serializePhaseDefinition),
      nbEquipesMin: concours.formule.nbEquipesMin,
      nbEquipesMax: concours.formule.nbEquipesMax,
    },
    reglement: {
      scoreVictoire: concours.reglement.scoreVictoire,
      dureeMaxMinutes: concours.reglement.dureeMaxMinutes,
      pointsVictoire: concours.reglement.pointsVictoire,
      pointsNul: concours.reglement.pointsNul,
      pointsDefaite: concours.reglement.pointsDefaite,
      nulAutorise: concours.reglement.nulAutorise,
      protectionClub: concours.reglement.protectionClub,
      protectionJoueurs: concours.reglement.protectionJoueurs,
      tetesDeSerieActives: concours.reglement.tetesDeSerieActives,
      methodeAppariement: concours.reglement.methodeAppariement,
      criteresClassement: concours.reglement.criteresClassement,
      scoreForfaitGagnant: concours.reglement.scoreForfaitGagnant,
      scoreForfaitPerdant: concours.reglement.scoreForfaitPerdant,
      forfaitEliminatoire: concours.reglement.forfaitEliminatoire,
      pauseEntreMatchsMinutes: concours.reglement.pauseEntreMatchsMinutes,
      rotationTerrains: concours.reglement.rotationTerrains,
    },
    terrains: [...concours.terrains].map(serializeTerrain),
    phases: [...concours.phases].map(serializePhase),
    inscriptions: [...concours.inscriptions].map(serializeInscription),
  };
}

// ─── DESERIALIZE ─────────────────────────────────────────────────────────────

function deserializePhaseDefinition(d: PhaseDefinitionData): PhaseDefinition {
  const rule = d.qualificationRule
    ? new QualificationRule(
        d.qualificationRule.type as TypeQualification,
        d.qualificationRule.nombre,
        d.qualificationRule.critere as CritereClassement,
      )
    : null;
  return new PhaseDefinition(
    d.type as TypePhase,
    d.drawStrategy,
    d.rankingCriteria as CritereClassement[],
    d.tiebreakChain as CritereClassement[],
    rule,
    d.constraints,
  );
}

function deserializeMatch(d: MatchData): Match {
  const score = d.score ? new Score(d.score.pointsA, d.score.pointsB) : null;
  const resultat = d.resultat
    ? new ResultatMatch(
        d.resultat.vainqueur,
        d.resultat.type as TypeResultat,
        new Score(d.resultat.score.pointsA, d.resultat.score.pointsB),
        d.resultat.pointsAttribuesA,
        d.resultat.pointsAttribuesB,
      )
    : null;
  return new Match(
    d.id,
    d.tourId,
    d.equipeAId,
    d.equipeBId,
    d.terrainId,
    d.horaire ? new Date(d.horaire) : null,
    d.statut as StatutMatch,
    score,
    resultat,
  );
}

function deserializeTour(d: TourData): Tour {
  const matchs = d.matchs.map(deserializeMatch);
  return new Tour(d.id, d.phaseId, d.numero, d.statut as StatutTour, matchs, d.nom);
}

function deserializeLigneClassement(d: LigneClassementData): LigneClassement {
  return {
    equipeId: d.equipeId,
    rang: d.rang,
    points: d.points,
    matchsJoues: d.matchsJoues,
    matchsGagnes: d.matchsGagnes,
    matchsPerdus: d.matchsPerdus,
    matchsNuls: d.matchsNuls,
    pointsMarques: d.pointsMarques,
    pointsEncaisses: d.pointsEncaisses,
    goalAverage: new GoalAverage(d.goalAverage.pointsMarques, d.goalAverage.pointsEncaisses),
    qualifiee: d.qualifiee,
  };
}

function deserializeClassement(d: ClassementData): Classement {
  const lignes = d.lignes.map(deserializeLigneClassement);
  return new Classement(d.phaseId, lignes, d.criteres as CritereClassement[]);
}

function deserializePhase(d: PhaseData): Phase {
  const config = deserializePhaseDefinition(d.config);
  const tours = d.tours.map(deserializeTour);
  const classement = d.classement ? deserializeClassement(d.classement) : null;
  return new Phase(
    d.id,
    d.concoursId,
    d.type as TypePhase,
    d.ordre,
    config,
    d.nom,
    d.statut as StatutPhase,
    tours,
    classement,
  );
}

function deserializeTerrain(d: TerrainData): Terrain {
  return new Terrain(d.id, d.concoursId, d.numero, d.nom, d.disponible, d.type);
}

function deserializeInscription(d: InscriptionData): Inscription {
  const equipe = new Equipe(d.equipe.id, d.equipe.joueurIds, d.equipe.clubId, d.equipe.nom, d.equipe.numero);
  return new Inscription(
    d.id,
    d.concoursId,
    equipe,
    new Date(d.horodatage),
    d.statut as StatutInscription,
    d.teteDeSerie,
  );
}

export function deserialize(data: ConcoursData): Concours {
  const dates = new DateRange(new Date(data.dateDebut), new Date(data.dateFin));

  const formulePhaseDefs = data.formule.phases.map(deserializePhaseDefinition);
  const formule = new FormuleConcours(
    data.formule.typeEquipe as TypeEquipe,
    formulePhaseDefs,
    data.formule.nbEquipesMin,
    data.formule.nbEquipesMax,
  );

  const reglement = new ReglementConcours({
    scoreVictoire: data.reglement.scoreVictoire,
    dureeMaxMinutes: data.reglement.dureeMaxMinutes,
    pointsVictoire: data.reglement.pointsVictoire,
    pointsNul: data.reglement.pointsNul,
    pointsDefaite: data.reglement.pointsDefaite,
    nulAutorise: data.reglement.nulAutorise,
    protectionClub: data.reglement.protectionClub,
    protectionJoueurs: data.reglement.protectionJoueurs,
    tetesDeSerieActives: data.reglement.tetesDeSerieActives,
    methodeAppariement: data.reglement.methodeAppariement as MethodeAppariement,
    criteresClassement: data.reglement.criteresClassement as CritereClassement[],
    scoreForfaitGagnant: data.reglement.scoreForfaitGagnant,
    scoreForfaitPerdant: data.reglement.scoreForfaitPerdant,
    forfaitEliminatoire: data.reglement.forfaitEliminatoire,
    pauseEntreMatchsMinutes: data.reglement.pauseEntreMatchsMinutes,
    rotationTerrains: data.reglement.rotationTerrains,
  });

  const terrains = data.terrains.map(deserializeTerrain);
  const phases = data.phases.map(deserializePhase);
  const inscriptions = data.inscriptions.map(deserializeInscription);

  return new Concours(
    data.id,
    data.nom,
    dates,
    data.lieu,
    data.organisateurId,
    formule,
    reglement,
    data.statut as StatutConcours,
    terrains,
    phases,
    inscriptions,
  );
}
