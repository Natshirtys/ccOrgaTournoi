import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { SaisirScoreDialog } from './SaisirScoreDialog';
import { CorrigerScoreDialog } from './CorrigerScoreDialog';
import { demarrerMatch, assignerTerrain } from '@/api/matchs';
import type { MatchDto, TerrainDto } from '@/types/concours';

interface BracketMatchCardProps {
  match: MatchDto;
  concoursId: string;
  equipeLookup: Map<string, string>;
  variant?: 'principal' | 'consolante';
  terrains?: TerrainDto[];
}

export function BracketMatchCard({ match, concoursId, equipeLookup, variant = 'principal', terrains = [] }: BracketMatchCardProps) {
  const queryClient = useQueryClient();

  const demarrerMutation = useMutation({
    mutationFn: () => demarrerMatch(concoursId, match.id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['concours', concoursId, 'matchs'] }),
  });

  const terrainMutation = useMutation({
    mutationFn: (terrainId: string) => assignerTerrain(concoursId, match.id, terrainId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['concours', concoursId, 'matchs'] }),
  });

  const nomA = equipeLookup.get(match.equipeAId) ?? 'À déterminer';
  const nomB = equipeLookup.get(match.equipeBId) ?? 'À déterminer';
  const score = match.score;
  const isTermine = match.statut === 'TERMINE' || match.statut === 'FORFAIT';

  const aWins = isTermine && score && score.equipeA > score.equipeB;
  const bWins = isTermine && score && score.equipeB > score.equipeA;

  const isConsolante = variant === 'consolante';
  const baseBg = isConsolante ? 'bg-amber-900 text-white' : 'bg-[var(--color-bracket-bg)] text-white';
  const winBg = isConsolante ? 'bg-amber-600 text-white font-semibold' : 'bg-green-600 text-white font-semibold';
  const borderColor = isConsolante ? 'border-amber-700' : 'border-[var(--color-bracket-card)]';
  const actionBg = isConsolante ? 'bg-amber-800' : 'bg-[var(--color-bracket-card)]';

  // Terrains disponibles pour le sélecteur (pas utilisés par un autre match actif)
  const canChangeTerrain = match.statut === 'PROGRAMME' || match.statut === 'EN_COURS';

  return (
    <div className={`bracket-match-card w-full rounded-lg overflow-hidden shadow-sm border ${borderColor}`}>
      {/* Terrain badge */}
      {match.terrainNumero != null && (
        <div className={`flex items-center justify-center ${actionBg} px-2 py-0.5 text-xs text-white/70`}>
          {canChangeTerrain && terrains.length > 0 ? (
            <select
              className="bg-transparent text-white/90 text-xs text-center cursor-pointer border-none outline-none appearance-none"
              value={match.terrainId ?? ''}
              onChange={(e) => terrainMutation.mutate(e.target.value)}
              disabled={terrainMutation.isPending}
            >
              {match.terrainId && (
                <option value={match.terrainId}>
                  T{match.terrainNumero}
                </option>
              )}
              {terrains
                .filter((t) => t.id !== match.terrainId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    T{t.numero}
                  </option>
                ))}
            </select>
          ) : (
            <span>T{match.terrainNumero}</span>
          )}
        </div>
      )}
      {/* Équipe A */}
      <div
        className={`flex items-center justify-between px-3 py-2 text-sm ${
          aWins ? winBg : baseBg
        }`}
      >
        <span className={`truncate ${!equipeLookup.has(match.equipeAId) ? 'italic opacity-60' : ''}`}>
          {nomA}
        </span>
        <span className="ml-2 shrink-0 font-mono text-xs font-bold">
          {score ? score.equipeA : ''}
        </span>
      </div>
      {/* Équipe B */}
      <div
        className={`flex items-center justify-between px-3 py-2 text-sm border-t ${borderColor} ${
          bWins ? winBg : baseBg
        }`}
      >
        <span className={`truncate ${!equipeLookup.has(match.equipeBId) ? 'italic opacity-60' : ''}`}>
          {nomB}
        </span>
        <span className="ml-2 shrink-0 font-mono text-xs font-bold">
          {score ? score.equipeB : ''}
        </span>
      </div>
      {/* Actions — always rendered to keep consistent card height */}
      <div className={`flex justify-center ${actionBg} px-2 py-1.5 min-h-[2rem]`}>
        {match.statut === 'PROGRAMME' && (
          <Button
            size="sm"
            variant="secondary"
            className="h-6 text-xs"
            onClick={() => demarrerMutation.mutate()}
            disabled={demarrerMutation.isPending}
          >
            Démarrer
          </Button>
        )}
        {match.statut === 'EN_COURS' && (
          <SaisirScoreDialog
            concoursId={concoursId}
            matchId={match.id}
            equipeANom={nomA}
            equipeBNom={nomB}
          />
        )}
        {match.statut === 'TERMINE' && match.canEditScore && match.score && (
          <CorrigerScoreDialog
            concoursId={concoursId}
            matchId={match.id}
            equipeANom={nomA}
            equipeBNom={nomB}
            currentScore={match.score}
          />
        )}
      </div>
    </div>
  );
}
