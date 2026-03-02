import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { SaisirScoreDialog } from './SaisirScoreDialog';
import { CorrigerScoreDialog } from './CorrigerScoreDialog';
import { demarrerMatch, declarerForfait, assignerTerrain } from '@/api/matchs';
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
}

export function MatchRow({ match, concoursId, equipeANom, equipeBNom, terrains = [] }: MatchRowProps) {
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

  const terrainMutation = useMutation({
    mutationFn: (terrainId: string) => assignerTerrain(concoursId, match.id, terrainId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['concours', concoursId, 'matchs'] }),
  });

  const statutConfig = STATUT_MATCH_LABELS[match.statut] ?? { label: match.statut, variant: 'outline' as const };
  const score = match.score;
  const canChangeTerrain = match.statut === 'PROGRAMME' || match.statut === 'EN_COURS';

  return (
    <TableRow>
      <TableCell className="font-medium">{equipeANom}</TableCell>
      <TableCell className="text-center text-muted-foreground">vs</TableCell>
      <TableCell className="font-medium">{equipeBNom}</TableCell>
      <TableCell className="text-center">
        {score ? `${score.equipeA} - ${score.equipeB}` : '—'}
      </TableCell>
      <TableCell>
        {canChangeTerrain && terrains.length > 0 ? (
          <select
            className="rounded border bg-background px-1.5 py-0.5 text-sm"
            value={match.terrainId ?? ''}
            onChange={(e) => terrainMutation.mutate(e.target.value)}
            disabled={terrainMutation.isPending}
          >
            <option value="" disabled>—</option>
            {match.terrainId && !terrains.some((t) => t.id === match.terrainId) && (
              <option value={match.terrainId}>T{match.terrainNumero}</option>
            )}
            {terrains.map((t) => (
              <option key={t.id} value={t.id}>
                T{t.numero}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-muted-foreground">
            {match.terrainNumero != null ? `T${match.terrainNumero}` : '—'}
          </span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={statutConfig.variant}>{statutConfig.label}</Badge>
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          {match.statut === 'PROGRAMME' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => demarrerMutation.mutate()}
              disabled={demarrerMutation.isPending}
            >
              Démarrer
            </Button>
          )}
          {match.statut === 'EN_COURS' && (
            <>
              <SaisirScoreDialog
                concoursId={concoursId}
                matchId={match.id}
                equipeANom={equipeANom}
                equipeBNom={equipeBNom}
              />
              <Button
                size="sm"
                variant="destructive"
                onClick={() => forfaitMutation.mutate(match.equipeAId)}
                disabled={forfaitMutation.isPending}
              >
                Forfait
              </Button>
            </>
          )}
          {match.statut === 'TERMINE' && (
            <>
              {match.resultat && (
                <span className="text-sm text-muted-foreground">{match.resultat}</span>
              )}
              {match.canEditScore && match.score && (
                <CorrigerScoreDialog
                  concoursId={concoursId}
                  matchId={match.id}
                  equipeANom={equipeANom}
                  equipeBNom={equipeBNom}
                  currentScore={match.score}
                />
              )}
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
