import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { SaisirScoreDialog } from './SaisirScoreDialog';
import { CorrigerScoreDialog } from './CorrigerScoreDialog';
import { TerrainBadge } from './TerrainBadge';
import { demarrerMatch, declarerForfait } from '@/api/matchs';
import type { MatchDto, TerrainDto } from '@/types/concours';

const STATUT_MATCH_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PROGRAMME: { label: 'Programmé', variant: 'outline' },
  EN_COURS: { label: 'En cours', variant: 'default' },
  TERMINE: { label: 'Terminé', variant: 'secondary' },
  FORFAIT: { label: 'Forfait', variant: 'destructive' },
};

interface MatchRowProps {
  match: MatchDto;
  concoursId: string;
  equipeANom: string;
  equipeBNom: string;
  terrains?: TerrainDto[];
  readOnly?: boolean;
}

export function MatchRow({ match, concoursId, equipeANom, equipeBNom, terrains = [], readOnly = false }: MatchRowProps) {
  const queryClient = useQueryClient();

  const demarrerMutation = useMutation({
    mutationFn: () => demarrerMatch(concoursId, match.id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['concours', concoursId, 'matchs'] }),
  });

  const forfaitMutation = useMutation({
    mutationFn: (equipeId: string) =>
      declarerForfait(concoursId, match.id, { equipeDeclarantForfaitId: equipeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['concours', concoursId, 'matchs'] });
      queryClient.invalidateQueries({ queryKey: ['concours', concoursId, 'classement'] });
    },
  });

  const statutConfig = STATUT_MATCH_LABELS[match.statut] ?? { label: match.statut, variant: 'outline' as const };
  const score = match.score;
  const isTermine = match.statut === 'TERMINE' || match.statut === 'FORFAIT';
  const aWins = isTermine && score && score.equipeA > score.equipeB;
  const bWins = isTermine && score && score.equipeB > score.equipeA;

  return (
    <TableRow className={cn(isTermine && 'bg-muted/30')}>
      {/* Équipe A */}
      <TableCell className={cn(
        'font-medium',
        aWins && 'font-bold text-foreground',
        !aWins && isTermine && 'text-muted-foreground',
      )}>
        {aWins && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500" />}
        {equipeANom}
      </TableCell>

      <TableCell className="text-center text-xs text-muted-foreground">vs</TableCell>

      {/* Équipe B */}
      <TableCell className={cn(
        'font-medium',
        bWins && 'font-bold text-foreground',
        !bWins && isTermine && 'text-muted-foreground',
      )}>
        {bWins && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500" />}
        {equipeBNom}
      </TableCell>

      {/* Score + action inline */}
      <TableCell className="text-center">
        {score ? (
          <div className="flex flex-col items-center gap-1">
            <span className="font-mono font-bold tracking-tight">
              <span className={cn('text-base', aWins ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>{score.equipeA}</span>
              <span className="mx-1 text-muted-foreground font-normal">–</span>
              <span className={cn('text-base', bWins ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>{score.equipeB}</span>
            </span>
            {!readOnly && match.statut === 'TERMINE' && match.canEditScore && (
              <CorrigerScoreDialog
                concoursId={concoursId}
                matchId={match.id}
                equipeANom={equipeANom}
                equipeBNom={equipeBNom}
                currentScore={match.score!}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <span className="text-muted-foreground">—</span>
            {!readOnly && match.statut === 'PROGRAMME' && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs"
                onClick={() => demarrerMutation.mutate()}
                disabled={demarrerMutation.isPending}
              >
                Démarrer
              </Button>
            )}
            {!readOnly && match.statut === 'EN_COURS' && (
              <div className="flex flex-col gap-1">
                <SaisirScoreDialog
                  concoursId={concoursId}
                  matchId={match.id}
                  equipeANom={equipeANom}
                  equipeBNom={equipeBNom}
                />
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-6 text-xs"
                  onClick={() => forfaitMutation.mutate(match.equipeAId)}
                  disabled={forfaitMutation.isPending}
                >
                  Forfait
                </Button>
              </div>
            )}
          </div>
        )}
      </TableCell>

      <TableCell>
        <TerrainBadge
          match={match}
          concoursId={concoursId}
          terrains={terrains}
          readOnly={readOnly}
        />
      </TableCell>
      <TableCell>
        <Badge variant={statutConfig.variant}>{statutConfig.label}</Badge>
      </TableCell>
    </TableRow>
  );
}
