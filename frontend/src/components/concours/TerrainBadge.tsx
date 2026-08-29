import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { assignerTerrain } from '@/api/matchs';
import type { MatchDto, TerrainDto } from '@/types/concours';
import { ActionError } from '@/components/ui/action-error';

interface TerrainBadgeProps {
  match: MatchDto;
  concoursId: string;
  terrains: TerrainDto[];
  readOnly?: boolean;
}

export function TerrainBadge({ match, concoursId, terrains, readOnly }: TerrainBadgeProps) {
  const queryClient = useQueryClient();
  const terrainMutation = useMutation({
    mutationFn: (terrainId: string) => assignerTerrain(concoursId, match.id, terrainId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['concours', concoursId, 'matchs'] }),
  });

  if (match.terrainNumero == null) return <span className="text-muted-foreground text-sm">—</span>;

  const canEdit =
    !readOnly &&
    (match.statut === 'PROGRAMME' || match.statut === 'EN_COURS') &&
    terrains.length > 0;

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="inline-flex min-h-10 items-center gap-1 rounded-md bg-primary/15 px-2 py-1 text-xs font-semibold text-primary dark:bg-primary/20 sm:min-h-0">
        <MapPin className="h-3 w-3 shrink-0" />
        {canEdit ? (
          <select
            className="-mr-1 cursor-pointer appearance-none border-none bg-transparent text-xs font-semibold text-primary outline-none"
            value={match.terrainId ?? ''}
            onChange={(e) => terrainMutation.mutate(e.target.value)}
            disabled={terrainMutation.isPending}
          >
            {match.terrainId && (
              <option value={match.terrainId}>T{match.terrainNumero}</option>
            )}
            {terrains
              .filter((t) => t.id !== match.terrainId)
              .map((t) => (
                <option key={t.id} value={t.id} disabled={!t.disponible}>
                  T{t.numero}{!t.disponible ? ' (indisponible)' : ''}
                </option>
              ))}
          </select>
        ) : (
          <span>T{match.terrainNumero}</span>
        )}
      </div>
      <ActionError error={terrainMutation.error} compact />
    </div>
  );
}
