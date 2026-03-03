import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SaisirScoreDialog } from './SaisirScoreDialog';
import { CorrigerScoreDialog } from './CorrigerScoreDialog';
import { demarrerMatch } from '@/api/matchs';
import type { MatchDto } from '@/types/concours';

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
    // Tri round-robin : points → diff score → score marqué
    return teams.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const diffA = a.pointsMarques - a.pointsEncaisses;
      const diffB = b.pointsMarques - b.pointsEncaisses;
      if (diffB !== diffA) return diffB - diffA;
      return b.pointsMarques - a.pointsMarques;
    });
  }

  // Tri GSL : points → victoires → diff score
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

// Couleurs de qualification pour le round-robin (3 qualifiés)
const RR_QUAL_STYLES = [
  { row: 'bg-green-50 border-b', label: '→ Champ. A', labelClass: 'text-green-700' },
  { row: 'bg-blue-50 border-b', label: '→ Champ. B', labelClass: 'text-blue-700' },
  { row: 'bg-orange-50 border-b', label: '→ Champ. C', labelClass: 'text-orange-700' },
];

export function PoolGroupCard({
  pouleIndex,
  equipeIds,
  matchs,
  equipeLookup,
  concoursId,
  mode = 'gsl',
  readOnly,
}: PoolGroupCardProps) {
  const pouleName = `POULE ${LETTERS[pouleIndex] ?? pouleIndex + 1}`;
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

  const letterLookup = useMemo(() => {
    const map = new Map<string, string>();
    equipeIds.forEach((id, i) => {
      map.set(id, LETTERS[i] ?? `${i + 1}`);
    });
    return map;
  }, [equipeIds]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-primary py-3">
        <CardTitle className="text-base text-primary-foreground">{pouleName}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Classement */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="w-10 px-3 py-2 text-center">#</th>
              <th className="px-3 py-2">Équipe</th>
              <th className="w-10 px-3 py-2 text-center">V</th>
              <th className="w-10 px-3 py-2 text-center">D</th>
              <th className="w-14 px-3 py-2 text-center">Diff</th>
              <th className="w-12 px-3 py-2 text-center">Pts</th>
              {mode === 'roundrobin' && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {classement.map((team, idx) => {
              const isQualified = idx < nbQualifies;
              const rrStyle = mode === 'roundrobin' && isQualified ? RR_QUAL_STYLES[idx] : null;
              const rowClass = rrStyle
                ? rrStyle.row
                : idx < 2
                  ? 'bg-green-50 border-b'
                  : 'border-b';

              return (
                <tr key={team.equipeId} className={rowClass}>
                  <td className="px-3 py-2 text-center">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-muted text-xs font-semibold">
                      {team.letter}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium">{team.nom}</td>
                  <td className="px-3 py-2 text-center">{team.victoires}</td>
                  <td className="px-3 py-2 text-center">{team.defaites}</td>
                  <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                    {(() => { const d = team.pointsMarques - team.pointsEncaisses; return d > 0 ? `+${d}` : `${d}`; })()}
                  </td>
                  <td className="px-3 py-2 text-center font-semibold">{team.points}</td>
                  {mode === 'roundrobin' && (
                    <td className={`px-3 py-2 text-xs font-medium ${rrStyle?.labelClass ?? 'text-muted-foreground'}`}>
                      {rrStyle ? rrStyle.label : 'Éliminé'}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Matchs par tour */}
        <div className="space-y-2 p-3">
          {matchsByTour.map(([tourNum, tourMatchs]) => (
            <div key={tourNum}>
              <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                {tourLabels[tourNum] ?? `Tour ${tourNum}`}
              </h4>
              <div className="space-y-1.5">
                {tourMatchs.map((m) => {
                  const nomA = equipeLookup.get(m.equipeAId) ?? m.equipeAId;
                  const nomB = equipeLookup.get(m.equipeBId) ?? m.equipeBId;
                  const letterA = letterLookup.get(m.equipeAId) ?? '?';
                  const letterB = letterLookup.get(m.equipeBId) ?? '?';
                  const score = m.score;
                  const isTermine = m.statut === 'TERMINE' || m.statut === 'FORFAIT';

                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5 text-sm"
                    >
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-muted text-xs font-semibold">
                        {letterA}
                      </span>
                      <span className={`flex-1 ${isTermine && score && score.equipeA > score.equipeB ? 'font-semibold' : ''}`}>
                        {nomA}
                      </span>
                      <span className="mx-1 font-mono text-xs font-semibold">
                        {score ? `${score.equipeA} - ${score.equipeB}` : 'vs'}
                      </span>
                      <span className={`flex-1 text-right ${isTermine && score && score.equipeB > score.equipeA ? 'font-semibold' : ''}`}>
                        {nomB}
                      </span>
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-muted text-xs font-semibold">
                        {letterB}
                      </span>
                      {m.terrainNumero != null && (
                        <span className="text-xs text-muted-foreground">T{m.terrainNumero}</span>
                      )}
                      <div className="ml-2 flex items-center gap-1">
                        {isTermine && (
                          <Badge variant="secondary" className="text-xs">
                            Terminé
                          </Badge>
                        )}
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
