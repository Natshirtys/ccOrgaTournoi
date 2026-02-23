import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventBus } from '../../infrastructure/events/in-memory-event-bus.js';
import { DomainEvent } from '../../shared/types.js';

interface TestEvent extends DomainEvent {
  eventType: 'TEST_EVENT';
  data: string;
}

function makeEvent(data: string, aggregateId = 'agg-1'): TestEvent {
  return { eventType: 'TEST_EVENT', occurredOn: new Date(), aggregateId, data };
}

describe('InMemoryEventBus', () => {
  let bus: InMemoryEventBus;

  beforeEach(() => {
    bus = new InMemoryEventBus();
  });

  it('publie un événement et le stocke', async () => {
    const event = makeEvent('hello');
    await bus.publish(event);

    expect(bus.getPublishedEvents()).toHaveLength(1);
    expect(bus.getPublishedEvents()[0]).toBe(event);
  });

  it('publie plusieurs événements avec publishAll', async () => {
    const events = [makeEvent('a'), makeEvent('b'), makeEvent('c')];
    await bus.publishAll(events);

    expect(bus.getPublishedEvents()).toHaveLength(3);
  });

  it('notifie les subscribers lors de la publication', async () => {
    const received: string[] = [];
    bus.subscribe<TestEvent>('TEST_EVENT', async (event) => {
      received.push(event.data);
    });

    await bus.publish(makeEvent('data-1'));
    await bus.publish(makeEvent('data-2'));

    expect(received).toEqual(['data-1', 'data-2']);
  });

  it('supporte plusieurs subscribers pour le même type', async () => {
    let count = 0;
    bus.subscribe('TEST_EVENT', async () => { count++; });
    bus.subscribe('TEST_EVENT', async () => { count++; });

    await bus.publish(makeEvent('x'));

    expect(count).toBe(2);
  });

  it('ne notifie pas les subscribers d\'un autre type', async () => {
    let called = false;
    bus.subscribe('OTHER_EVENT', async () => { called = true; });

    await bus.publish(makeEvent('x'));

    expect(called).toBe(false);
  });

  it('unsubscribe supprime les handlers', async () => {
    let called = false;
    bus.subscribe('TEST_EVENT', async () => { called = true; });
    bus.unsubscribe('TEST_EVENT');

    await bus.publish(makeEvent('x'));

    expect(called).toBe(false);
  });

  it('getEventsByType filtre correctement', async () => {
    await bus.publish(makeEvent('a'));
    await bus.publish({ eventType: 'OTHER', occurredOn: new Date(), aggregateId: 'x' });
    await bus.publish(makeEvent('b'));

    expect(bus.getEventsByType('TEST_EVENT')).toHaveLength(2);
    expect(bus.getEventsByType('OTHER')).toHaveLength(1);
  });

  it('clear remet tout à zéro', async () => {
    bus.subscribe('TEST_EVENT', async () => {});
    await bus.publish(makeEvent('x'));

    bus.clear();

    expect(bus.getPublishedEvents()).toHaveLength(0);
  });
});
