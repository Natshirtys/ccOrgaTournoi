import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SaisirScoreDialog } from './SaisirScoreDialog';
import { CorrigerScoreDialog } from './CorrigerScoreDialog';
import { TerrainBadge } from './TerrainBadge';
import { demarrerMatch } from '@/api/matchs';
import type { MatchDto, TerrainDto } from '@/types/concours';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const TOUR_LABELS_GSL: Record<number, string> = {
  1: 'Tour 1',
  2: 'Tour 2 — Gagnants / Perdants',
  3: 'Tour 3 — Barrage',
};

const TOUR_LABELS_RR: Record<number, string> = {
  1: 'Tour 1 — A-B / C-D',
  2: 'Tour 2 — A-C / B-D',
  3: 'Tour 3 — A-D / B-C',
};

interface PoolGroupCardProps {
  pouleIndex: number;
  equipeIds: string[];
  matchs: MatchDto[];
  equipeLookup: Map<string, string>;
  concoursId: string;
  mode?: 'gsl' | 'roundrobin';
  terrains?: TerrainDto[];
  readOnly?: boolean;
}

interface TeamStats {
  equipeId: string;
  nom: string;
  letter: string;
  victoires: number;
  defaites: number;
  points: number;
  pointsMarques: number;
  pointsEncaisses: number;
}

function computeClassement(
  equipeIds: string[],
  matchs: MatchDto[],
  equipeLookup: Map<string, string>,
  mode: 'gsl' | 'roundrobin',
): TeamStats[] {
  const statsMap = new Map<string, TeamStats>();

  equipeIds.forEach((id, i) => {
    statsMap.set(id, {
      equipeId: id,
      nom: equipeLookup.get(id) ?? id,
      letter: LETTERS[i] ?? `${i + 1}`,
      victoires: 0,
      defaites: 0,
      points: 0,
      pointsMarques: 0,
      pointsEncaisses: 0,
    });
  });

  for (const m of matchs) {
    if (m.statut !== 'TERMINE' && m.statut !== 'FORFAIT') continue;
    if (!m.score) continue;

    const statsA = statsMap.get(m.equipeAId);
    const statsB = statsMap.get(m.equipeBId);
    if (!statsA || !statsB) continue;

    statsA.pointsMarques += m.score.equipeA;
    statsA.pointsEncaisses += m.score.equipeB;
    statsB.pointsMarques += m.score.equipeB;
    statsB.pointsEncaisses += m.score.equipeA;

    if (m.score.equipeA > m.score.equipeB) {
      statsA.victoires++;
      statsA.points += 2;
      statsB.defaites++;
    } else if (m.score.equipeB > m.score.equipeA) {
      statsB.victoires++;
      statsB.points += 2;
      statsA.defaites++;
    } else {
      statsA.points += 1;
      statsB.points += 1;
    }
  }

  const teams = Array.from(statsMap.values());

  if (mode === 'roundrobin') {
    return teams.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const diffA = a.pointsMarques - a.pointsEncaisses;
      const diffB = b.pointsMarques - b.pointsEncaisses;
      if (diffB !== diffA) return diffB - diffA;
      return b.pointsMarques - a.pointsMarques;
    });
  }

  return teams.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.victoires !== a.victoires) return b.victoires - a.victoires;
    return (b.pointsMarques - b.pointsEncaisses) - (a.pointsMarques - a.pointsEncaisses);
  });
}


function PoolMatchActions({
  match,
  concoursId,
  equipeANom,
  equipeBNom,
  readOnly,
}: {
  match: MatchDto;
  concoursId: string;
  equipeANom: string;
  equipeBNom: string;
  readOnly?: boolean;
}) {
  const queryClient = useQueryClient();

  const demarrerMutation = useMutation({
    mutationFn: () => demarrerMatch(concoursId, match.id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['concours', concoursId, 'matchs'] }),
  });

  if (readOnly) return null;

  if (match.statut === 'PROGRAMME') {
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        onClick={() => demarrerMutation.mutate()}
        disabled={demarrerMutation.isPending}
      >
        Démarrer
      </Button>
    );
  }
  if (match.statut === 'EN_COURS') {
    return (
      <SaisirScoreDialog
        concoursId={concoursId}
        matchId={match.id}
        equipeANom={equipeANom}
        equipeBNom={equipeBNom}
      />
    );
  }
  if (match.statut === 'TERMINE' && match.canEditScore && match.score) {
    return (
      <CorrigerScoreDialog
        concoursId={concoursId}
        matchId={match.id}
        equipeANom={equipeANom}
        equipeBNom={equipeBNom}
        currentScore={match.score}
      />
    );
  }
  return null;
}

// Styles par rang pour round-robin (3 qualifiés)
const RR_RANK_CONFIG = [
  {
    accent: 'border-l-emerald-500',
    bg: 'bg-emerald-50/60 dark:bg-emerald-900/25',
    rankBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-800/50 dark:text-emerald-200',
    label: 'Champ. A',
    labelClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-800/50 dark:text-emerald-200',
  },
  {
    accent: 'border-l-blue-500',
    bg: 'bg-blue-50/60 dark:bg-blue-900/25',
    rankBg: 'bg-blue-100 text-blue-800 dark:bg-blue-800/50 dark:text-blue-200',
    label: 'Champ. B',
    labelClass: 'bg-blue-100 text-blue-800 dark:bg-blue-800/50 dark:text-blue-200',
  },
  {
    accent: 'border-l-amber-500',
    bg: 'bg-amber-50/60 dark:bg-amber-900/25',
    rankBg: 'bg-amber-100 text-amber-800 dark:bg-amber-800/50 dark:text-amber-200',
    label: 'Champ. C',
    labelClass: 'bg-amber-100 text-amber-800 dark:bg-amber-800/50 dark:text-amber-200',
  },
];

export function PoolGroupCard({
  pouleIndex,
  equipeIds,
  matchs,
  equipeLookup,
  concoursId,
  mode = 'gsl',
  terrains = [],
  readOnly,
}: PoolGroupCardProps) {
  const pouleLetter = LETTERS[pouleIndex] ?? String(pouleIndex + 1);
  const tourLabels = mode === 'roundrobin' ? TOUR_LABELS_RR : TOUR_LABELS_GSL;
  const nbQualifies = mode === 'roundrobin' ? 3 : 2;

  const classement = useMemo(
    () => computeClassement(equipeIds, matchs, equipeLookup, mode),
    [equipeIds, matchs, equipeLookup, mode],
  );

  const matchsByTour = useMemo(() => {
    const tours = new Map<number, MatchDto[]>();
    for (const m of matchs) {
      if (!tours.has(m.tourNumero)) tours.set(m.tourNumero, []);
      tours.get(m.tourNumero)!.push(m);
    }
    return Array.from(tours.entries()).sort(([a], [b]) => a - b);
  }, [matchs]);

  return (
    <Card className="overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center bg-primary px-4 py-3">
        <span className="text-sm font-bold tracking-widest text-white uppercase">
          Poule {pouleLetter}
        </span>
      </div>

      <CardContent className="p-0">
        {/* Classement */}
        <div className="divide-y">
          {/* En-tête du tableau */}
          <div className="grid grid-cols-[1.5rem_1fr_2rem_2rem_2.5rem] xl:grid-cols-[1.5rem_1fr_5rem_2rem_2rem_3rem_3rem_3rem_2.5rem] items-center gap-x-2 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="text-center">#</span>
            <span>Équipe</span>
            <span className="hidden xl:block text-center">Dest.</span>
            <span className="text-center">V</span>
            <span className="text-center">D</span>
            <span className="hidden xl:block text-center">Pm</span>
            <span className="hidden xl:block text-center">Pe</span>
            <span className="hidden xl:block text-center">Diff</span>
            <span className="text-center">Pts</span>
          </div>

          {classement.map((team, idx) => {
            const isQualified = idx < nbQualifies;
            const rrConfig = mode === 'roundrobin' && isQualified ? RR_RANK_CONFIG[idx] : null;
            const diff = team.pointsMarques - team.pointsEncaisses;

            return (
              <div
                key={team.equipeId}
                className={cn(
                  'grid grid-cols-[1.5rem_1fr_2rem_2rem_2.5rem] xl:grid-cols-[1.5rem_1fr_5rem_2rem_2rem_3rem_3rem_3rem_2.5rem] items-center gap-x-2 border-l-4 px-4 py-2.5 text-sm',
                  rrConfig
                    ? cn(rrConfig.bg, rrConfig.accent)
                    : mode === 'gsl' && isQualified
                      ? 'border-l-emerald-500 bg-emerald-50/60 dark:bg-emerald-900/20'
                      : 'border-l-border bg-muted/20',
                )}
              >
                {/* Rang */}
                <span
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold',
                    rrConfig
                      ? rrConfig.rankBg
                      : mode === 'gsl' && isQualified
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {idx + 1}
                </span>

                {/* Équipe */}
                <span className="truncate font-medium min-w-0">{team.nom}</span>

                {/* Destination */}
                <div className="hidden xl:flex justify-center">
                  {rrConfig ? (
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', rrConfig.labelClass)}>
                      {rrConfig.label}
                    </span>
                  ) : mode === 'roundrobin' ? (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Éliminé
                    </span>
                  ) : null}
                </div>

                {/* V */}
                <span className="text-center tabular-nums">{team.victoires}</span>
                {/* D */}
                <span className="text-center tabular-nums text-muted-foreground">{team.defaites}</span>
                {/* Pm */}
                <span className="hidden xl:block text-center tabular-nums text-xs text-emerald-700">{team.pointsMarques}</span>
                {/* Pe */}
                <span className="hidden xl:block text-center tabular-nums text-xs text-destructive/70">{team.pointsEncaisses}</span>
                {/* Diff */}
                <span className={cn('hidden xl:block text-center text-xs tabular-nums font-medium', diff > 0 ? 'text-emerald-700' : diff < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                  {diff > 0 ? `+${diff}` : diff}
                </span>
                {/* Pts */}
                <span className="text-center font-bold tabular-nums">{team.points}</span>
              </div>
            );
          })}
        </div>

        {/* Séparateur */}
        <div className="mx-4 my-3 border-t border-dashed" />

        {/* Matchs par tour */}
        <div className="space-y-4 px-4 pb-4">
          {matchsByTour.map(([tourNum, tourMatchs]) => (
            <div key={tourNum}>
              {/* Label du tour */}
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {tourLabels[tourNum] ?? `Tour ${tourNum}`}
                </span>
                <div className="flex-1 border-t border-muted" />
              </div>

              <div className="space-y-1.5">
                {tourMatchs.map((m) => {
                  const nomA = equipeLookup.get(m.equipeAId) ?? m.equipeAId;
                  const nomB = equipeLookup.get(m.equipeBId) ?? m.equipeBId;
                  const score = m.score;
                  const isTermine = m.statut === 'TERMINE' || m.statut === 'FORFAIT';
                  const isEnCours = m.statut === 'EN_COURS';
                  const aWins = isTermine && score && score.equipeA > score.equipeB;
                  const bWins = isTermine && score && score.equipeB > score.equipeA;

                  return (
                    <div
                      key={m.id}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                        isTermine
                          ? 'bg-muted/50 border-border'
                          : isEnCours
                            ? 'bg-primary/10 border-primary/30'
                            : 'bg-card border-border',
                      )}
                    >
                      {/* Status icon */}
                      <div className="shrink-0">
                        {isTermine ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        ) : isEnCours ? (
                          <Circle className="h-3.5 w-3.5 fill-primary text-primary" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
                        )}
                      </div>

                      {/* Équipe A */}
                      <div className="flex min-w-0 flex-1 items-center">
                        <span className={cn('truncate', aWins ? 'font-semibold' : isTermine ? 'text-muted-foreground' : '')}>
                          {nomA}
                        </span>
                      </div>

                      {/* Score */}
                      <div className="shrink-0 min-w-[4rem] text-center">
                        {score ? (
                          <span className="font-mono text-sm font-bold tracking-tight">
                            {score.equipeA}
                            <span className="mx-1 font-normal text-muted-foreground">-</span>
                            {score.equipeB}
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-muted-foreground">vs</span>
                        )}
                      </div>

                      {/* Équipe B */}
                      <div className="flex min-w-0 flex-1 items-center justify-end">
                        <span className={cn('truncate text-right', bWins ? 'font-semibold' : isTermine ? 'text-muted-foreground' : '')}>
                          {nomB}
                        </span>
                      </div>

                      {/* Terrain */}
                      <TerrainBadge
                        match={m}
                        concoursId={concoursId}
                        terrains={terrains}
                        readOnly={readOnly}
                      />

                      {/* Actions */}
                      <div className="shrink-0">
                        <PoolMatchActions
                          match={m}
                          concoursId={concoursId}
                          equipeANom={nomA}
                          equipeBNom={nomB}
                          readOnly={readOnly}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
