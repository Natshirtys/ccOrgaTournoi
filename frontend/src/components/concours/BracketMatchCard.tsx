import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { SaisirScoreDialog } from './SaisirScoreDialog';
import { demarrerMatch } from '@/api/matchs';
import type { MatchDto } from '@/types/concours';

interface BracketMatchCardProps {
  match: MatchDto;
  concoursId: string;
  equipeLookup: Map<string, string>;
}

export function BracketMatchCard({ match, concoursId, equipeLookup }: BracketMatchCardProps) {
  const queryClient = useQueryClient();

  const demarrerMutation = useMutation({
    mutationFn: () => demarrerMatch(concoursId, match.id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['concours', concoursId, 'matchs'] }),
  });

  const nomA = equipeLookup.get(match.equipeAId) ?? 'À déterminer';
  const nomB = equipeLookup.get(match.equipeBId) ?? 'À déterminer';
  const score = match.score;
  const isTermine = match.statut === 'TERMINE' || match.statut === 'FORFAIT';

  const aWins = isTermine && score && score.equipeA > score.equipeB;
  const bWins = isTermine && score && score.equipeB > score.equipeA;

  return (
    <div className="bracket-match-card w-full rounded-lg overflow-hidden shadow-sm border border-[var(--color-bracket-card)]">
      {/* Équipe A */}
      <div
        className={`flex items-center justify-between px-3 py-2 text-sm ${
          aWins
            ? 'bg-green-600 text-white font-semibold'
            : 'bg-[var(--color-bracket-bg)] text-white'
        }`}
      >
        <span className={!equipeLookup.has(match.equipeAId) ? 'italic opacity-60' : ''}>
          {nomA}
        </span>
        <span className="ml-2 font-mono text-xs font-bold">
          {score ? score.equipeA : ''}
        </span>
      </div>
      {/* Équipe B */}
      <div
        className={`flex items-center justify-between px-3 py-2 text-sm border-t border-[var(--color-bracket-card)] ${
          bWins
            ? 'bg-green-600 text-white font-semibold'
            : 'bg-[var(--color-bracket-bg)] text-white'
        }`}
      >
        <span className={!equipeLookup.has(match.equipeBId) ? 'italic opacity-60' : ''}>
          {nomB}
        </span>
        <span className="ml-2 font-mono text-xs font-bold">
          {score ? score.equipeB : ''}
        </span>
      </div>
      {/* Actions */}
      {(match.statut === 'PROGRAMME' || match.statut === 'EN_COURS') && (
        <div className="flex justify-center bg-[var(--color-bracket-card)] px-2 py-1.5">
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
        </div>
      )}
    </div>
  );
}
