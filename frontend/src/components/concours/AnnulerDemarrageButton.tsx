import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { annulerDemarrageMatch } from '@/api/matchs';
import { ActionError } from '@/components/ui/action-error';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AnnulerDemarrageButtonProps {
  concoursId: string;
  matchId: string;
  compact?: boolean;
  className?: string;
}

export function AnnulerDemarrageButton({
  concoursId,
  matchId,
  compact = false,
  className,
}: AnnulerDemarrageButtonProps) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => annulerDemarrageMatch(concoursId, matchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['concours', concoursId] });
    },
  });

  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className={cn(
          compact ? 'h-8 w-8 p-0' : 'h-10 gap-1.5 px-3 text-sm sm:h-8 sm:text-xs',
          'text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
          className,
        )}
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        title="Annuler le démarrage et remettre le match en attente"
        aria-label="Annuler le démarrage du match"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {!compact && (mutation.isPending ? 'Annulation…' : 'Remettre en attente')}
      </Button>
      <ActionError error={mutation.error} compact />
    </div>
  );
}
