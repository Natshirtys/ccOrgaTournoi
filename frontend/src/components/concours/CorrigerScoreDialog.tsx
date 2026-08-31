import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ActionError } from '@/components/ui/action-error';
import { corrigerScore } from '@/api/matchs';

interface CorrigerScoreDialogProps {
  concoursId: string;
  matchId: string;
  equipeANom: string;
  equipeBNom: string;
  currentScore: { equipeA: number; equipeB: number };
}

export function CorrigerScoreDialog({
  concoursId,
  matchId,
  equipeANom,
  equipeBNom,
  currentScore,
}: CorrigerScoreDialogProps) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [scoreA, setScoreA] = useState(String(currentScore.equipeA));
  const [scoreB, setScoreB] = useState(String(currentScore.equipeB));

  const mutation = useMutation({
    mutationFn: () =>
      corrigerScore(concoursId, matchId, {
        scoreEquipeA: parseInt(scoreA, 10),
        scoreEquipeB: parseInt(scoreB, 10),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['concours', concoursId] });
      setEditOpen(false);
    },
  });

  function handleTrigger() {
    setScoreA(String(currentScore.equipeA));
    setScoreB(String(currentScore.equipeB));
    setConfirmOpen(true);
  }

  function handleConfirm() {
    setConfirmOpen(false);
    setEditOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-10 w-10 sm:h-8 sm:w-auto"
        onClick={handleTrigger}
        title="Corriger le score"
      >
        <Pencil className="h-3 w-3" />
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Corriger ce score ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le score {currentScore.equipeA} – {currentScore.equipeB} a déjà été saisi. Cette
              modification est définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Modifier le score</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Corriger le score</DialogTitle>
            <DialogDescription>
              {equipeANom} vs {equipeBNom}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="corr-scoreA">{equipeANom}</Label>
                <Input
                  id="corr-scoreA"
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
                <Label htmlFor="corr-scoreB">{equipeBNom}</Label>
                <Input
                  id="corr-scoreB"
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
    </>
  );
}
