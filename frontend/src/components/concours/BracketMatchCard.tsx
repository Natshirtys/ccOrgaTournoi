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

// Tokens sémantiques par variant — respectent light/dark via CSS variables
const TOKENS = {
  principal: {
    cardBg:    'bg-bracket-bg border-bracket-card',
    barBg:     'bg-black/20',
    lineColor: 'text-bracket-line',
    fg:        'text-bracket-fg',
    fgMuted:   'text-bracket-fg/40',
    fgDim:     'text-bracket-fg/30',
    fgScore:   'text-bracket-fg/45',
    divider:   'border-bracket-fg/15',
    winner:    'text-emerald-600',
    winnerDot: 'bg-emerald-500',
    winnerBg:  'bg-emerald-500/15',
    enCours:   'text-emerald-600',
  },
  consolante: {
    cardBg:    'bg-bracket-consolante-bg border-bracket-consolante-card',
    barBg:     'bg-black/25',
    lineColor: 'text-bracket-consolante-line',
    fg:        'text-[var(--color-bracket-consolante-fg)]',
    fgMuted:   'text-[var(--color-bracket-consolante-fg)]/40',
    fgDim:     'text-[var(--color-bracket-consolante-fg)]/30',
    fgScore:   'text-[var(--color-bracket-consolante-fg)]/45',
    divider:   'border-[var(--color-bracket-consolante-fg)]/15',
    winner:    'text-emerald-600',
    winnerDot: 'bg-emerald-500',
    winnerBg:  'bg-emerald-500/15',
    enCours:   'text-emerald-600',
  },
} as const;

type TokenSet = typeof TOKENS[keyof typeof TOKENS];

function TeamRow({
  nom,
  score,
  isWinner,
  isLoser,
  isTbd,
  tokens,
}: {
  nom: string;
  score?: number;
  isWinner: boolean;
  isLoser: boolean;
  isTbd: boolean;
  tokens: TokenSet;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2.5 transition-colors',
        isWinner && tokens.winnerBg,
        isLoser && 'opacity-35',
      )}
    >
      {/* Indicateur gagnant */}
      <span
        className={cn(
          'h-2 w-2 shrink-0 rounded-full transition-colors',
          isWinner ? tokens.winnerDot : 'bg-transparent',
        )}
      />
      {/* Nom */}
      <span
        className={cn(
          'flex-1 truncate text-sm',
          isTbd ? cn('italic', tokens.fgDim) : tokens.fg,
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
            isWinner ? tokens.winner : tokens.fgScore,
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

  const tokens = TOKENS[variant];
  const canChangeTerrain =
    !readOnly && (match.statut === 'PROGRAMME' || match.statut === 'EN_COURS');

  return (
    <div className={cn('bracket-match-card w-full overflow-hidden rounded-lg shadow-lg border', tokens.cardBg)}>

      {/* Barre supérieure : terrain + statut */}
      <div className={cn('flex items-center justify-between px-3 py-1.5', tokens.barBg)}>
        {/* Terrain */}
        {match.terrainNumero != null ? (
          canChangeTerrain && terrains.length > 0 ? (
            <select
              className={cn(
                'bg-transparent text-xs font-bold cursor-pointer border-none outline-none appearance-none',
                tokens.lineColor,
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
            <span className={cn('text-xs font-bold', tokens.lineColor)}>
              {match.terrainNom ?? `T${match.terrainNumero}`}
            </span>
          )
        ) : (
          <span />
        )}

        {/* Indicateur de statut */}
        {isEnCours && (
          <span className={cn('flex items-center gap-1 text-[10px] font-semibold', tokens.enCours)}>
            <span className={cn('h-1.5 w-1.5 animate-pulse rounded-full', tokens.winnerDot)} />
            En cours
          </span>
        )}
        {isTermine && (
          <span className={cn('text-[10px]', tokens.fgMuted)}>Terminé</span>
        )}
      </div>

      {/* Équipe A */}
      <TeamRow
        nom={nomA}
        score={score?.equipeA}
        isWinner={!!aWins}
        isLoser={!!bWins}
        isTbd={!equipeLookup.has(match.equipeAId)}
        tokens={tokens}
      />

      {/* Séparateur */}
      <div className={cn('border-t', tokens.divider)} />

      {/* Équipe B */}
      <TeamRow
        nom={nomB}
        score={score?.equipeB}
        isWinner={!!bWins}
        isLoser={!!aWins}
        isTbd={!equipeLookup.has(match.equipeBId)}
        tokens={tokens}
      />

      {/* Barre actions — hauteur fixe pour l'alignement du bracket */}
      <div className={cn('flex items-center justify-center px-2 py-1.5 min-h-[2rem]', tokens.barBg)}>
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
