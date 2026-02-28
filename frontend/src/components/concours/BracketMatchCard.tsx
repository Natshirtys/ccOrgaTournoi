import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { SaisirScoreDialog } from './SaisirScoreDialog';
import { demarrerMatch } from '@/api/matchs';
import type { MatchDto } from '@/types/concours';

interface BracketMatchCardProps {
  match: MatchDto;
  concoursId: string;
  equipeLookup: Map<string, string>;
  variant?: 'principal' | 'consolante';
}

export function BracketMatchCard({ match, concoursId, equipeLookup, variant = 'principal' }: BracketMatchCardProps) {
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

  const isConsolante = variant === 'consolante';
  const baseBg = isConsolante ? 'bg-amber-900 text-white' : 'bg-[var(--color-bracket-bg)] text-white';
  const winBg = isConsolante ? 'bg-amber-600 text-white font-semibold' : 'bg-green-600 text-white font-semibold';
  const borderColor = isConsolante ? 'border-amber-700' : 'border-[var(--color-bracket-card)]';
  const actionBg = isConsolante ? 'bg-amber-800' : 'bg-[var(--color-bracket-card)]';

  return (
    <div className={`bracket-match-card w-full rounded-lg overflow-hidden shadow-sm border ${borderColor}`}>
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
      </div>
    </div>
  );
}
