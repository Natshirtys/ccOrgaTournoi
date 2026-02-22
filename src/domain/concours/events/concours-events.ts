import { DomainEvent } from '../../../shared/types.js';

export class ConcoursCreated implements DomainEvent {
  readonly eventType = 'ConcoursCreated';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly concoursId: string,
    public readonly nom: string,
  ) {
    this.occurredOn = new Date();
  }
}

export class ConcoursProgrammed implements DomainEvent {
  readonly eventType = 'ConcoursProgrammed';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly concoursId: string,
  ) {
    this.occurredOn = new Date();
  }
}

export class InscriptionAdded implements DomainEvent {
  readonly eventType = 'InscriptionAdded';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly concoursId: string,
    public readonly inscriptionId: string,
    public readonly equipeId: string,
  ) {
    this.occurredOn = new Date();
  }
}

export class InscriptionCancelled implements DomainEvent {
  readonly eventType = 'InscriptionCancelled';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly concoursId: string,
    public readonly inscriptionId: string,
  ) {
    this.occurredOn = new Date();
  }
}

export class InscriptionsClosed implements DomainEvent {
  readonly eventType = 'InscriptionsClosed';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly concoursId: string,
    public readonly nbEquipes: number,
  ) {
    this.occurredOn = new Date();
  }
}

export class TirageEffectue implements DomainEvent {
  readonly eventType = 'TirageEffectue';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly concoursId: string,
    public readonly phaseId: string,
  ) {
    this.occurredOn = new Date();
  }
}

export class TirageAnnule implements DomainEvent {
  readonly eventType = 'TirageAnnule';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly concoursId: string,
    public readonly phaseId: string,
  ) {
    this.occurredOn = new Date();
  }
}

export class PhaseStarted implements DomainEvent {
  readonly eventType = 'PhaseStarted';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly concoursId: string,
    public readonly phaseId: string,
    public readonly typePhase: string,
  ) {
    this.occurredOn = new Date();
  }
}

export class PhaseCompleted implements DomainEvent {
  readonly eventType = 'PhaseCompleted';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly concoursId: string,
    public readonly phaseId: string,
  ) {
    this.occurredOn = new Date();
  }
}

export class QualifiesAnnonces implements DomainEvent {
  readonly eventType = 'QualifiesAnnonces';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly concoursId: string,
    public readonly phaseId: string,
    public readonly equipeIds: string[],
  ) {
    this.occurredOn = new Date();
  }
}

export class TourStarted implements DomainEvent {
  readonly eventType = 'TourStarted';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly concoursId: string,
    public readonly phaseId: string,
    public readonly tourId: string,
    public readonly numero: number,
  ) {
    this.occurredOn = new Date();
  }
}

export class TourCompleted implements DomainEvent {
  readonly eventType = 'TourCompleted';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly concoursId: string,
    public readonly phaseId: string,
    public readonly tourId: string,
  ) {
    this.occurredOn = new Date();
  }
}

export class MatchProgramme implements DomainEvent {
  readonly eventType = 'MatchProgramme';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly concoursId: string,
    public readonly matchId: string,
    public readonly equipeAId: string,
    public readonly equipeBId: string,
    public readonly terrainId: string,
  ) {
    this.occurredOn = new Date();
  }
}

export class MatchDemarre implements DomainEvent {
  readonly eventType = 'MatchDemarre';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly concoursId: string,
    public readonly matchId: string,
  ) {
    this.occurredOn = new Date();
  }
}

export class ScoreSaisi implements DomainEvent {
  readonly eventType = 'ScoreSaisi';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly concoursId: string,
    public readonly matchId: string,
    public readonly pointsA: number,
    public readonly pointsB: number,
  ) {
    this.occurredOn = new Date();
  }
}

export class ScoreCorrige implements DomainEvent {
  readonly eventType = 'ScoreCorrige';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly concoursId: string,
    public readonly matchId: string,
    public readonly ancienScore: { pointsA: number; pointsB: number },
    public readonly nouveauScore: { pointsA: number; pointsB: number },
  ) {
    this.occurredOn = new Date();
  }
}

export class MatchTermine implements DomainEvent {
  readonly eventType = 'MatchTermine';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly concoursId: string,
    public readonly matchId: string,
    public readonly vainqueurId: string,
  ) {
    this.occurredOn = new Date();
  }
}

export class ForfaitDeclare implements DomainEvent {
  readonly eventType = 'ForfaitDeclare';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly concoursId: string,
    public readonly matchId: string,
    public readonly equipeId: string,
  ) {
    this.occurredOn = new Date();
  }
}

export class AbandonDeclare implements DomainEvent {
  readonly eventType = 'AbandonDeclare';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly concoursId: string,
    public readonly matchId: string,
    public readonly equipeId: string,
  ) {
    this.occurredOn = new Date();
  }
}

export class ClassementRecalcule implements DomainEvent {
  readonly eventType = 'ClassementRecalcule';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly concoursId: string,
    public readonly phaseId: string,
  ) {
    this.occurredOn = new Date();
  }
}

export class DepartageEffectue implements DomainEvent {
  readonly eventType = 'DepartageEffectue';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly concoursId: string,
    public readonly phaseId: string,
    public readonly criteresUtilises: string[],
  ) {
    this.occurredOn = new Date();
  }
}

export class TerrainLibere implements DomainEvent {
  readonly eventType = 'TerrainLibere';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly concoursId: string,
    public readonly terrainId: string,
  ) {
    this.occurredOn = new Date();
  }
}

export class ConflitTerrainDetecte implements DomainEvent {
  readonly eventType = 'ConflitTerrainDetecte';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly concoursId: string,
    public readonly terrainId: string,
    public readonly matchIds: string[],
  ) {
    this.occurredOn = new Date();
  }
}
