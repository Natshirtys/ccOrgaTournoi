import { cn } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { SaisirScoreDialog } from './SaisirScoreDialog';
import { CorrigerScoreDialog } from './CorrigerScoreDialog';
import { demarrerMatch, assignerTerrain } from '@/api/matchs';
import type { MatchDto, TerrainDto } from '@/types/concours';
import { ActionError } from '@/components/ui/action-error';

interface BracketMatchCardProps {
  match: MatchDto;
  concoursId: string;
  equipeLookup: Map<string, string>;
  variant?: 'principal' | 'consolante';
  terrains?: TerrainDto[];
  readOnly?: boolean;
}

// Accents par tableau, sur une surface neutre commune pour garder l'arbre lisible.
const TOKENS = {
  principal: {
    cardBg:    'bg-card border-border/80',
    barBg:     'bg-muted/35',
    lineColor: 'text-primary',
    fg:        'text-card-foreground',
    fgMuted:   'text-muted-foreground',
    fgDim:     'text-muted-foreground/70',
    fgScore:   'text-muted-foreground',
    divider:   'border-border/70',
    winner:    'text-emerald-700 dark:text-emerald-400',
    winnerDot: 'border-emerald-500 bg-emerald-500',
    winnerBg:  'bg-emerald-500/10',
    enCours:   'text-emerald-700 dark:text-emerald-400',
  },
  consolante: {
    cardBg:    'bg-card border-amber-500/25',
    barBg:     'bg-amber-500/[0.06]',
    lineColor: 'text-amber-700 dark:text-amber-300',
    fg:        'text-card-foreground',
    fgMuted:   'text-muted-foreground',
    fgDim:     'text-muted-foreground/70',
    fgScore:   'text-muted-foreground',
    divider:   'border-border/70',
    winner:    'text-emerald-700 dark:text-emerald-400',
    winnerDot: 'border-emerald-500 bg-emerald-500',
    winnerBg:  'bg-emerald-500/10',
    enCours:   'text-emerald-700 dark:text-emerald-400',
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
        'flex min-h-10 items-center gap-2.5 px-3 py-2 transition-colors',
        isWinner && tokens.winnerBg,
        isLoser && 'opacity-55',
      )}
    >
      {/* Indicateur gagnant */}
      <span
        className={cn(
          'h-2 w-2 shrink-0 rounded-full border border-border transition-colors',
          isWinner ? tokens.winnerDot : 'bg-transparent',
        )}
      />
      {/* Nom */}
      <span
        className={cn(
          'flex-1 truncate text-sm',
          isTbd ? cn('italic', tokens.fgDim) : tokens.fg,
          isWinner && 'font-medium',
        )}
      >
        {nom}
      </span>
      {/* Score */}
      {score !== undefined && (
        <span
          className={cn(
            'shrink-0 text-lg font-semibold leading-none tabular-nums',
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
  const nomB = match.equipeBId
    ? (equipeLookup.get(match.equipeBId) ?? 'À déterminer')
    : 'Exempt';
  const score = match.score;
  const isTermine = match.statut === 'TERMINE' || match.statut === 'FORFAIT';
  const isEnCours = match.statut === 'EN_COURS';

  const aWins = isTermine && score != null && score.equipeA > score.equipeB;
  const bWins = isTermine && score != null && score.equipeB > score.equipeA;

  const tokens = TOKENS[variant];
  const canChangeTerrain =
    !readOnly && (match.statut === 'PROGRAMME' || match.statut === 'EN_COURS');
  const canCorrectScore =
    !readOnly && match.statut === 'TERMINE' && match.canEditScore && match.score;
  const hasFooter =
    demarrerMutation.error
    || terrainMutation.error
    || (!readOnly && (match.statut === 'PROGRAMME' || match.statut === 'EN_COURS'));

  return (
    <div className={cn(
      'bracket-match-card w-full overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md',
      tokens.cardBg,
    )}>

      {/* Barre supérieure : terrain + statut */}
      <div className={cn('flex min-h-8 items-center justify-between gap-2 border-b px-3 py-1.5', tokens.divider, tokens.barBg)}>
        {/* Terrain */}
        {match.terrainNumero != null ? (
          canChangeTerrain && terrains.length > 0 ? (
            <select
              className={cn(
                'min-h-9 cursor-pointer appearance-none border-none bg-transparent text-xs font-bold outline-none sm:min-h-0',
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
        <div className="flex items-center gap-1.5">
          {isEnCours && (
            <span className={cn('flex items-center gap-1 text-[10px] font-semibold', tokens.enCours)}>
              <span className={cn('h-1.5 w-1.5 animate-pulse rounded-full border-0', tokens.winnerDot)} />
              En cours
            </span>
          )}
          {isTermine && (
            <span className={cn('text-[10px]', tokens.fgMuted)}>Terminé</span>
          )}
          {canCorrectScore && (
            <CorrigerScoreDialog
              concoursId={concoursId}
              matchId={match.id}
              equipeANom={nomA}
              equipeBNom={nomB}
              currentScore={match.score!}
            />
          )}
        </div>
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
        isTbd={match.equipeBId !== null && !equipeLookup.has(match.equipeBId)}
        tokens={tokens}
      />

      {/* Les matchs terminés restent compacts ; seules les actions utiles ouvrent un pied de carte. */}
      {hasFooter && (
      <div className={cn('flex min-h-9 items-center justify-center border-t px-2 py-1.5', tokens.divider, tokens.barBg)}>
        <ActionError error={demarrerMutation.error ?? terrainMutation.error} compact />
        {!demarrerMutation.error && !terrainMutation.error && (
          <>
        {!readOnly && match.statut === 'PROGRAMME' && (
          <Button
            size="sm"
            variant="secondary"
            className="h-10 px-4 text-sm sm:h-6 sm:px-3 sm:text-xs"
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
          </>
        )}
      </div>
      )}
    </div>
  );
}
