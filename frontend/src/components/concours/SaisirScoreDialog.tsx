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
      queryClient.invalidateQueries({ queryKey: ['concours', concoursId, 'matchs'] });
      queryClient.invalidateQueries({ queryKey: ['concours', concoursId, 'classement'] });
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
        <Button size="sm" variant="outline">
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
                min="0"
                value={scoreA}
                onChange={(e) => setScoreA(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="scoreB">{equipeBNom}</Label>
              <Input
                id="scoreB"
                type="number"
                min="0"
                value={scoreB}
                onChange={(e) => setScoreB(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
