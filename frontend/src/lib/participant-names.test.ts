import { describe, expect, it } from 'vitest';
import { splitParticipantNames } from './participant-names';

describe('splitParticipantNames', () => {
  it('sépare une saisie de plusieurs joueurs délimitée par des virgules', () => {
    expect(splitParticipantNames('Bibi, Franck M., Fifi Vano, Laurent, Kéké, Audrey, Kenzo')).toEqual([
      'Bibi',
      'Franck M.',
      'Fifi Vano',
      'Laurent',
      'Kéké',
      'Audrey',
      'Kenzo',
    ]);
  });
});
