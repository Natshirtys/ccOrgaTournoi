import { useMemo } from 'react';
import { BracketMatchCard } from './BracketMatchCard';
import type { MatchDto } from '@/types/concours';

interface KnockoutBracketProps {
  matchs: MatchDto[];
  concoursId: string;
  equipeLookup: Map<string, string>;
}

const ROUND_NAMES: Record<number, string> = {
  1: 'Finale',
  2: 'Demi-finales',
  3: 'Quarts de finale',
  4: '8es de finale',
  5: '16es de finale',
};

function getRoundName(roundsFromEnd: number, totalRounds: number): string {
  return ROUND_NAMES[roundsFromEnd] ?? `Tour ${totalRounds - roundsFromEnd + 1}`;
}

export function KnockoutBracket({ matchs, concoursId, equipeLookup }: KnockoutBracketProps) {
  const rounds = useMemo(() => {
    const byTour = new Map<number, MatchDto[]>();
    for (const m of matchs) {
      if (!byTour.has(m.tourNumero)) byTour.set(m.tourNumero, []);
      byTour.get(m.tourNumero)!.push(m);
    }
    return Array.from(byTour.entries())
      .sort(([a], [b]) => a - b)
      .map(([tourNum, tourMatchs]) => ({ tourNum, matchs: tourMatchs }));
  }, [matchs]);

  const totalRounds = rounds.length;

  if (totalRounds === 0) return null;

  return (
    <div className="overflow-x-auto pb-4">
      <div
        className="bracket-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${totalRounds}, minmax(200px, 1fr))`,
          gap: '1rem',
          minWidth: `${totalRounds * 220}px`,
        }}
      >
        {/* Headers */}
        {rounds.map(({ tourNum }, idx) => {
          const roundsFromEnd = totalRounds - idx;
          return (
            <div
              key={`header-${tourNum}`}
              className="text-center text-sm font-bold uppercase tracking-wide text-[var(--color-bracket-line)]
                         bg-[var(--color-bracket-bg)] rounded-t-lg py-2"
            >
              {getRoundName(roundsFromEnd, totalRounds)}
            </div>
          );
        })}

        {/* Match columns */}
        {rounds.map(({ tourNum, matchs: roundMatchs }, colIdx) => {
          const roundsFromEnd = totalRounds - colIdx;
          // Vertical spacing increases for later rounds to align with bracket lines
          const spacingClass =
            roundsFromEnd === 1
              ? 'justify-center'
              : roundsFromEnd === 2
                ? 'justify-around'
                : 'justify-around';

          return (
            <div
              key={`col-${tourNum}`}
              className={`flex flex-col gap-4 ${spacingClass} relative`}
            >
              {roundMatchs.map((m, matchIdx) => (
                <div key={m.id} className="relative bracket-match-wrapper">
                  <BracketMatchCard
                    match={m}
                    concoursId={concoursId}
                    equipeLookup={equipeLookup}
                  />
                  {/* Connector line to next round */}
                  {colIdx < totalRounds - 1 && (
                    <div
                      className="bracket-connector"
                      data-position={matchIdx % 2 === 0 ? 'top' : 'bottom'}
                    />
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
