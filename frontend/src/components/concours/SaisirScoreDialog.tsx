import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ActionError } from '@/components/ui/action-error';
import { saisirScore } from '@/api/matchs';

interface SaisirScoreDialogProps {
  concoursId: string;
  matchId: string;
  equipeANom: string;
  equipeBNom: string;
}

export function SaisirScoreDialog({
  concoursId,
  matchId,
  equipeANom,
  equipeBNom,
}: SaisirScoreDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      saisirScore(concoursId, matchId, {
        scoreEquipeA: parseInt(scoreA, 10),
        scoreEquipeB: parseInt(scoreB, 10),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['concours', concoursId] });
      setOpen(false);
      setScoreA('');
      setScoreB('');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-10 px-4 sm:h-8 sm:px-3">
          Score
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Saisir le score</DialogTitle>
          <DialogDescription>
            {equipeANom} vs {equipeBNom}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="scoreA">{equipeANom}</Label>
              <Input
                id="scoreA"
                type="number"
                inputMode="numeric"
                min="0"
                value={scoreA}
                onChange={(e) => setScoreA(e.target.value)}
                required
                className="h-12 text-center text-lg font-semibold sm:h-9 sm:text-sm"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="scoreB">{equipeBNom}</Label>
              <Input
                id="scoreB"
                type="number"
                inputMode="numeric"
                min="0"
                value={scoreB}
                onChange={(e) => setScoreB(e.target.value)}
                required
                className="h-12 text-center text-lg font-semibold sm:h-9 sm:text-sm"
              />
            </div>
          </div>
          <ActionError error={mutation.error} />
          <DialogFooter>
            <Button type="submit" className="h-11 w-full sm:h-9 sm:w-auto" disabled={mutation.isPending}>
              {mutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
