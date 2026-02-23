import { DomainEvent } from '../../shared/types.js';
import { EventPublisher, EventSubscriber } from '../../domain/concours/ports/event-publisher.js';

type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => Promise<void>;

/**
 * Bus d'événements in-memory synchrone.
 * Implémente à la fois EventPublisher et EventSubscriber.
 * Les handlers sont exécutés séquentiellement pour chaque événement publié.
 */
export class InMemoryEventBus implements EventPublisher, EventSubscriber {
  private handlers = new Map<string, EventHandler[]>();
  private publishedEvents: DomainEvent[] = [];

  async publish(event: DomainEvent): Promise<void> {
    this.publishedEvents.push(event);
    const handlers = this.handlers.get(event.eventType) ?? [];
    for (const handler of handlers) {
      await handler(event);
    }
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  subscribe<T extends DomainEvent>(eventType: string, handler: (event: T) => Promise<void>): void {
    const existing = this.handlers.get(eventType) ?? [];
    existing.push(handler as EventHandler);
    this.handlers.set(eventType, existing);
  }

  unsubscribe(eventType: string): void {
    this.handlers.delete(eventType);
  }

  /**
   * Retourne tous les événements publiés (utile pour les tests et le debug).
   */
  getPublishedEvents(): readonly DomainEvent[] {
    return this.publishedEvents;
  }

  /**
   * Retourne les événements d'un type donné.
   */
  getEventsByType(eventType: string): DomainEvent[] {
    return this.publishedEvents.filter((e) => e.eventType === eventType);
  }

  /**
   * Remet à zéro les événements et handlers (utile pour les tests).
   */
  clear(): void {
    this.publishedEvents = [];
    this.handlers.clear();
  }
}
