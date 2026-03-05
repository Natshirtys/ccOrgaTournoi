import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { assignerTerrain } from '@/api/matchs';
import type { MatchDto, TerrainDto } from '@/types/concours';

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
    <div className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-1 text-xs font-semibold text-primary dark:bg-primary/20">
      <MapPin className="h-3 w-3 shrink-0" />
      {canEdit ? (
        <select
          className="bg-transparent text-xs font-semibold text-primary cursor-pointer border-none outline-none appearance-none -mr-1"
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
                T{t.numero}{!t.disponible ? ' (en cours)' : ''}
              </option>
            ))}
        </select>
      ) : (
        <span>T{match.terrainNumero}</span>
      )}
    </div>
  );
}
