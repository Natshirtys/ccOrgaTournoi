import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BracketMatchCard } from './BracketMatchCard';
import { genererTourSuivant } from '@/api/concours';
import type { MatchDto, TerrainDto } from '@/types/concours';

interface KnockoutBracketProps {
  matchs: MatchDto[];
  concoursId: string;
  equipeLookup: Map<string, string>;
  variant?: 'principal' | 'consolante';
  phaseId?: string;
  terrains?: TerrainDto[];
}

const ROUND_NAMES: Record<number, string> = {
  1: 'Finale',
  2: 'Demi-finales',
  3: 'Quarts de finale',
  4: '8èmes de finale',
  5: '16èmes de finale',
};

function getFallbackRoundName(roundsFromEnd: number, totalRounds: number): string {
  return ROUND_NAMES[roundsFromEnd] ?? `Tour ${totalRounds - roundsFromEnd + 1}`;
}

export function KnockoutBracket({
  matchs,
  concoursId,
  equipeLookup,
  variant = 'principal',
  phaseId,
  terrains = [],
}: KnockoutBracketProps) {
  const queryClient = useQueryClient();

  const tourSuivantMutation = useMutation({
    mutationFn: () => genererTourSuivant(concoursId, phaseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['concours'] });
      queryClient.invalidateQueries({ queryKey: ['concours', concoursId] });
      queryClient.invalidateQueries({ queryKey: ['concours', concoursId, 'matchs'] });
    },
  });

  const rounds = useMemo(() => {
    const byTour = new Map<number, MatchDto[]>();
    for (const m of matchs) {
      if (!byTour.has(m.tourNumero)) byTour.set(m.tourNumero, []);
      byTour.get(m.tourNumero)!.push(m);
    }
    return Array.from(byTour.entries())
      .sort(([a], [b]) => a - b)
      .map(([tourNum, tourMatchs]) => ({
        tourNum,
        matchs: tourMatchs,
        nom: tourMatchs[0]?.tourNom,
      }));
  }, [matchs]);

  const totalRounds = rounds.length;

  if (totalRounds === 0) return null;

  const isConsolante = variant === 'consolante';
  const headerBg = isConsolante
    ? 'bg-amber-700 text-white'
    : 'bg-[var(--color-bracket-bg)] text-[var(--color-bracket-line)]';

  // Card height: 2 team rows (~36px each) + action area (32px) + borders ≈ 106px
  const CARD_HEIGHT = 106;
  const GAP = 16;

  // Check if the last round has all matches finished → can advance
  const lastRound = rounds[rounds.length - 1];
  const lastRoundComplete = lastRound?.matchs.every(
    (m) => m.statut === 'TERMINE' || m.statut === 'FORFAIT',
  );
  // Don't show button if the last round is already a finale (1 match)
  const canAdvance = lastRoundComplete && lastRound.matchs.length > 1;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto pb-4">
        <div
          className="bracket-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${totalRounds}, minmax(200px, 1fr))`,
            columnGap: '2.5rem',
            minWidth: `${totalRounds * 240}px`,
          }}
        >
          {/* Column headers */}
          {rounds.map(({ tourNum, nom }, idx) => {
            const roundsFromEnd = totalRounds - idx;
            const displayName = nom ?? getFallbackRoundName(roundsFromEnd, totalRounds);
            return (
              <div
                key={`header-${tourNum}`}
                className={`text-center text-sm font-bold uppercase tracking-wide
                           rounded-t-lg py-2 ${headerBg}`}
              >
                {displayName}
              </div>
            );
          })}

          {/* Match columns */}
          {rounds.map(({ tourNum, matchs: roundMatchs }, colIdx) => {
            // Calculate vertical padding to center-align with previous round
            const paddingTop = colIdx === 0 ? 0 : (CARD_HEIGHT + GAP) * (Math.pow(2, colIdx) - 1) / 2;

            return (
              <div
                key={`col-${tourNum}`}
                className="flex flex-col relative"
                style={{
                  gap: `${GAP + (CARD_HEIGHT + GAP) * (Math.pow(2, colIdx) - 1)}px`,
                  paddingTop: `${paddingTop}px`,
                }}
              >
                {roundMatchs.map((m, matchIdx) => (
                  <div key={m.id} className="relative bracket-match-wrapper">
                    <BracketMatchCard
                      match={m}
                      concoursId={concoursId}
                      equipeLookup={equipeLookup}
                      variant={variant}
                      terrains={terrains}
                    />
                    {/* Connector: horizontal line going right */}
                    {colIdx < totalRounds - 1 && (
                      <div
                        className="bracket-connector"
                        data-position={matchIdx % 2 === 0 ? 'top' : 'bottom'}
                        style={{
                          ['--connector-height' as string]:
                            `${(CARD_HEIGHT + GAP + (CARD_HEIGHT + GAP) * (Math.pow(2, colIdx) - 1)) / 2}px`,
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tour suivant button per bracket */}
      {canAdvance && phaseId && (
        <div className="flex justify-center">
          <Button
            size="sm"
            variant={isConsolante ? 'outline' : 'secondary'}
            className={isConsolante ? 'border-amber-600 text-amber-700 hover:bg-amber-50' : ''}
            onClick={() => tourSuivantMutation.mutate()}
            disabled={tourSuivantMutation.isPending}
          >
            <ChevronRight className="mr-1 h-4 w-4" />
            {tourSuivantMutation.isPending
              ? 'Génération...'
              : 'Générer le tour suivant'}
          </Button>
        </div>
      )}
    </div>
  );
}
