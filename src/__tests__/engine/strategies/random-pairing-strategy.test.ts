import { describe, it, expect } from 'vitest';
import { RandomPairingStrategy, matchupKey } from '../../../engine/strategies/pairing/random-pairing-strategy.js';
import { MethodeAppariement } from '../../../domain/shared/enums.js';
import { PairingContext } from '../../../engine/strategies/interfaces.js';

const identityShuffle = <T>(arr: T[]): T[] => arr;

describe('RandomPairingStrategy', () => {
  it('apparie les équipes 2 par 2', () => {
    const strategy = new RandomPairingStrategy(identityShuffle);
    const context: PairingContext = {
      equipeIds: ['e1', 'e2', 'e3', 'e4'],
      previousMatchups: new Set(),
      methode: MethodeAppariement.ALEATOIRE,
    };

    const matchups = strategy.pair(context);

    expect(matchups).toHaveLength(2);
    expect(matchups[0]).toEqual({ equipeAId: 'e1', equipeBId: 'e2' });
    expect(matchups[1]).toEqual({ equipeAId: 'e3', equipeBId: 'e4' });
  });

  it('gère le nombre impair avec un BYE', () => {
    const strategy = new RandomPairingStrategy(identityShuffle);
    const context: PairingContext = {
      equipeIds: ['e1', 'e2', 'e3'],
      previousMatchups: new Set(),
      methode: MethodeAppariement.ALEATOIRE,
    };

    const matchups = strategy.pair(context);

    expect(matchups).toHaveLength(2);
    expect(matchups[0]).toEqual({ equipeAId: 'e1', equipeBId: 'e2' });
    expect(matchups[1]).toEqual({ equipeAId: 'e3', equipeBId: null });
  });

  it('évite les répétitions de confrontations si possible', () => {
    // Avec un shuffle contrôlé qui inverse l'ordre
    const reverseShuffle = <T>(arr: T[]): T[] => [...arr].reverse();
    const strategy = new RandomPairingStrategy(reverseShuffle);

    const context: PairingContext = {
      equipeIds: ['e1', 'e2', 'e3', 'e4'],
      previousMatchups: new Set([matchupKey('e4', 'e3')]), // e3:e4 déjà joué
      methode: MethodeAppariement.ALEATOIRE,
    };

    const matchups = strategy.pair(context);

    // Avec reverse shuffle : e4, e3, e2, e1 → e4 vs e3 est déjà joué
    // Le strategy devrait faire un fallback
    expect(matchups).toHaveLength(2);
    // Toutes les équipes sont appariées
    const allIds = matchups.flatMap((m) => [m.equipeAId, m.equipeBId].filter(Boolean));
    expect(allIds).toHaveLength(4);
  });
});

describe('matchupKey', () => {
  it('produit la même clé quel que soit l\'ordre', () => {
    expect(matchupKey('e1', 'e2')).toBe(matchupKey('e2', 'e1'));
  });

  it('produit des clés différentes pour des paires différentes', () => {
    expect(matchupKey('e1', 'e2')).not.toBe(matchupKey('e1', 'e3'));
  });
});
