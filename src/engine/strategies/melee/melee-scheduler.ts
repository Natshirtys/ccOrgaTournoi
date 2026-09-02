import { PosteMelee } from '../../../domain/shared/enums.js';

export interface MeleePlayer {
  id: string;
  poste: PosteMelee;
}

export interface MeleeMatchHistory {
  equipeA: readonly string[];
  equipeB: readonly string[];
  vainqueurIds?: readonly string[];
}

export interface MeleeScheduledMatch {
  equipeA: string[];
  equipeB: string[];
}

type Random = () => number;

function shuffle<T>(values: readonly T[], random: Random): T[] {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function rolePenalty(team: readonly MeleePlayer[]): number {
  const pointers = team.filter((p) => p.poste === PosteMelee.POINTEUR).length;
  const shooters = team.filter((p) => p.poste === PosteMelee.TIREUR).length;
  const versatile = team.filter((p) => p.poste === PosteMelee.POLYVALENT).length;
  const missingPointer = pointers === 0 && versatile === 0 ? 1 : 0;
  const missingShooter = shooters === 0 && versatile === 0 ? 1 : 0;
  return (missingPointer + missingShooter) * 20 + Math.max(0, pointers - 1) + Math.max(0, shooters - 1);
}

function buildCounts(history: readonly MeleeMatchHistory[]) {
  const partners = new Map<string, number>();
  const opponents = new Map<string, number>();
  for (const match of history) {
    for (const team of [match.equipeA, match.equipeB]) {
      for (let i = 0; i < team.length; i++) {
        for (let j = i + 1; j < team.length; j++) {
          const key = pairKey(team[i], team[j]);
          partners.set(key, (partners.get(key) ?? 0) + 1);
        }
      }
    }
    for (const a of match.equipeA) {
      for (const b of match.equipeB) {
        const key = pairKey(a, b);
        opponents.set(key, (opponents.get(key) ?? 0) + 1);
      }
    }
  }
  return { partners, opponents };
}

interface ScheduleScore {
  roles: number;
  partners: number;
  opponents: number;
}

function isBetterScore(candidate: ScheduleScore, reference: ScheduleScore | null): boolean {
  if (!reference) return true;
  if (candidate.roles !== reference.roles) return candidate.roles < reference.roles;
  if (candidate.partners !== reference.partners) return candidate.partners < reference.partners;
  return candidate.opponents < reference.opponents;
}

function scheduleScore(teams: readonly MeleePlayer[][], history: readonly MeleeMatchHistory[]): ScheduleScore {
  const { partners, opponents } = buildCounts(history);
  const score: ScheduleScore = {
    roles: teams.reduce((sum, team) => sum + rolePenalty(team), 0),
    partners: 0,
    opponents: 0,
  };
  for (let index = 0; index < teams.length; index += 2) {
    const a = teams[index];
    const b = teams[index + 1];
    for (let i = 0; i < a.length; i++) {
      for (let j = i + 1; j < a.length; j++) score.partners += partners.get(pairKey(a[i].id, a[j].id)) ?? 0;
    }
    for (let i = 0; i < b.length; i++) {
      for (let j = i + 1; j < b.length; j++) score.partners += partners.get(pairKey(b[i].id, b[j].id)) ?? 0;
    }
    for (const pa of a) for (const pb of b) score.opponents += opponents.get(pairKey(pa.id, pb.id)) ?? 0;
  }
  return score;
}

export function validateMeleePlayerCount(total: number, playersPerTeam: number): void {
  const playersPerMatch = playersPerTeam * 2;
  if (total < playersPerMatch || total % playersPerMatch !== 0) {
    throw new Error(`Le nombre de participants (${total}) doit être un multiple de ${playersPerMatch}`);
  }
}

export function generateRotatingMeleeRound(
  players: readonly MeleePlayer[],
  playersPerTeam: number,
  history: readonly MeleeMatchHistory[],
  random: Random = Math.random,
): MeleeScheduledMatch[] {
  validateMeleePlayerCount(players.length, playersPerTeam);
  let best: MeleePlayer[][] | null = null;
  let bestScore: ScheduleScore | null = null;
  for (let attempt = 0; attempt < 500; attempt++) {
    const ordered = shuffle(players, random);
    const teams: MeleePlayer[][] = [];
    for (let i = 0; i < ordered.length; i += playersPerTeam) teams.push(ordered.slice(i, i + playersPerTeam));
    const score = scheduleScore(teams, history);
    if (isBetterScore(score, bestScore)) {
      best = teams;
      bestScore = score;
      if (score.roles === 0 && score.partners === 0 && score.opponents === 0) break;
    }
  }
  return (best ?? []).reduce<MeleeScheduledMatch[]>((matches, team, index, all) => {
    if (index % 2 === 0) matches.push({ equipeA: team.map((p) => p.id), equipeB: all[index + 1].map((p) => p.id) });
    return matches;
  }, []);
}

export function generateFixedMeleeTeams(
  players: readonly MeleePlayer[],
  playersPerTeam: number,
  random: Random = Math.random,
): string[][] {
  validateMeleePlayerCount(players.length, playersPerTeam);
  let best: MeleePlayer[][] = [];
  let bestScore = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < 300; attempt++) {
    const ordered = shuffle(players, random);
    const teams: MeleePlayer[][] = [];
    for (let i = 0; i < ordered.length; i += playersPerTeam) teams.push(ordered.slice(i, i + playersPerTeam));
    const score = teams.reduce((sum, team) => sum + rolePenalty(team), 0);
    if (score < bestScore) { best = teams; bestScore = score; }
  }
  return best.map((team) => team.map((player) => player.id));
}

export function pairFixedMeleeTeams(
  teams: readonly string[][],
  history: readonly MeleeMatchHistory[],
  winnersAgainstWinners: boolean,
  random: Random = Math.random,
): MeleeScheduledMatch[] {
  const wins = new Map<string, number>();
  const teamKey = (team: readonly string[]) => [...team].sort().join('|');
  for (const match of history) {
    if (!match.vainqueurIds) continue;
    const key = teamKey(match.vainqueurIds);
    wins.set(key, (wins.get(key) ?? 0) + 1);
  }
  const previous = new Set(history.map((match) => pairKey(teamKey(match.equipeA), teamKey(match.equipeB))));
  let best: string[][] = [];
  let bestScore = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < 300; attempt++) {
    const ordered = shuffle(teams, random).sort((a, b) => winnersAgainstWinners
      ? (wins.get(teamKey(b)) ?? 0) - (wins.get(teamKey(a)) ?? 0)
      : 0);
    let score = 0;
    for (let i = 0; i < ordered.length; i += 2) {
      if (previous.has(pairKey(teamKey(ordered[i]), teamKey(ordered[i + 1])))) score += 1000;
      if (winnersAgainstWinners) score += Math.abs((wins.get(teamKey(ordered[i])) ?? 0) - (wins.get(teamKey(ordered[i + 1])) ?? 0)) * 100;
    }
    if (score < bestScore) { best = ordered; bestScore = score; }
  }
  const matches: MeleeScheduledMatch[] = [];
  for (let i = 0; i < best.length; i += 2) matches.push({ equipeA: [...best[i]], equipeB: [...best[i + 1]] });
  return matches;
}
