import { DomainEvent } from '../../../shared/types.js';

export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: DomainEvent[]): Promise<void>;
}

export interface EventSubscriber {
  subscribe<T extends DomainEvent>(eventType: string, handler: (event: T) => Promise<void>): void;
  unsubscribe(eventType: string): void;
}
