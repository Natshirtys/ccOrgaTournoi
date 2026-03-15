import { cn } from '@/lib/utils';
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
  readOnly?: boolean;
}

function TeamRow({
  nom,
  score,
  isWinner,
  isLoser,
  isTbd,
}: {
  nom: string;
  score?: number;
  isWinner: boolean;
  isLoser: boolean;
  isTbd: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2.5 transition-colors',
        isWinner && 'bg-emerald-600/20',
        isLoser && 'opacity-35',
      )}
    >
      {/* Indicateur gagnant */}
      <span
        className={cn(
          'h-2 w-2 shrink-0 rounded-full transition-colors',
          isWinner ? 'bg-emerald-400' : 'bg-transparent',
        )}
      />
      {/* Nom */}
      <span
        className={cn(
          'flex-1 truncate text-sm',
          isTbd ? 'italic text-white/30' : 'text-white',
          isWinner && 'font-semibold',
        )}
      >
        {nom}
      </span>
      {/* Score */}
      {score !== undefined && (
        <span
          className={cn(
            'shrink-0 font-mono font-black text-lg leading-none tabular-nums',
            isWinner ? 'text-emerald-300' : 'text-white/45',
          )}
        >
          {score}
        </span>
      )}
    </div>
  );
}

export function BracketMatchCard({
  match,
  concoursId,
  equipeLookup,
  variant = 'principal',
  terrains = [],
  readOnly = false,
}: BracketMatchCardProps) {
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
  const isEnCours = match.statut === 'EN_COURS';

  const aWins = isTermine && score != null && score.equipeA > score.equipeB;
  const bWins = isTermine && score != null && score.equipeB > score.equipeA;

  const isConsolante = variant === 'consolante';
  const canChangeTerrain =
    !readOnly && (match.statut === 'PROGRAMME' || match.statut === 'EN_COURS');

  return (
    <div
      className={cn(
        'bracket-match-card w-full overflow-hidden rounded-lg shadow-lg border',
        isConsolante
          ? 'border-amber-700 bg-amber-950'
          : 'border-[var(--color-bracket-card)] bg-[var(--color-bracket-bg)]',
      )}
    >
      {/* Barre supérieure : terrain + statut */}
      <div
        className={cn(
          'flex items-center justify-between px-3 py-1.5',
          isConsolante ? 'bg-black/25' : 'bg-black/20',
        )}
      >
        {/* Terrain */}
        {match.terrainNumero != null ? (
          canChangeTerrain && terrains.length > 0 ? (
            <select
              className={cn(
                'bg-transparent text-xs font-bold cursor-pointer border-none outline-none appearance-none',
                isConsolante
                  ? 'text-amber-300'
                  : 'text-[var(--color-bracket-line)]',
              )}
              value={match.terrainId ?? ''}
              onChange={(e) => terrainMutation.mutate(e.target.value)}
              disabled={terrainMutation.isPending}
            >
              {match.terrainId && (
                <option value={match.terrainId}>
                  {match.terrainNom ?? `T${match.terrainNumero}`}
                </option>
              )}
              {terrains
                .filter((t) => t.id !== match.terrainId)
                .map((t) => (
                  <option key={t.id} value={t.id} disabled={!t.disponible}>
                    {t.nom}{!t.disponible ? ' ●' : ''}
                  </option>
                ))}
            </select>
          ) : (
            <span
              className={cn(
                'text-xs font-bold',
                isConsolante
                  ? 'text-amber-300/80'
                  : 'text-[var(--color-bracket-line)]',
              )}
            >
              {match.terrainNom ?? `T${match.terrainNumero}`}
            </span>
          )
        ) : (
          <span />
        )}

        {/* Indicateur de statut */}
        {isEnCours && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            En cours
          </span>
        )}
        {isTermine && (
          <span className="text-[10px] text-white/40">Terminé</span>
        )}
      </div>

      {/* Équipe A */}
      <TeamRow
        nom={nomA}
        score={score?.equipeA}
        isWinner={!!aWins}
        isLoser={!!bWins}
        isTbd={!equipeLookup.has(match.equipeAId)}
      />

      {/* Séparateur */}
      <div className="border-t border-white/10" />

      {/* Équipe B */}
      <TeamRow
        nom={nomB}
        score={score?.equipeB}
        isWinner={!!bWins}
        isLoser={!!aWins}
        isTbd={!equipeLookup.has(match.equipeBId)}
      />

      {/* Barre actions — hauteur fixe pour l'alignement du bracket */}
      <div
        className={cn(
          'flex items-center justify-center px-2 py-1.5 min-h-[2rem]',
          isConsolante
            ? 'bg-black/25'
            : 'bg-black/20',
        )}
      >
        {!readOnly && match.statut === 'PROGRAMME' && (
          <Button
            size="sm"
            variant="secondary"
            className="h-6 px-3 text-xs"
            onClick={() => demarrerMutation.mutate()}
            disabled={demarrerMutation.isPending}
          >
            Démarrer
          </Button>
        )}
        {!readOnly && match.statut === 'EN_COURS' && (
          <SaisirScoreDialog
            concoursId={concoursId}
            matchId={match.id}
            equipeANom={nomA}
            equipeBNom={nomB}
          />
        )}
        {!readOnly &&
          match.statut === 'TERMINE' &&
          match.canEditScore &&
          match.score && (
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
