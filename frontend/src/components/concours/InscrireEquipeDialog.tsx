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
import { Checkbox } from '@/components/ui/checkbox';
import { inscrireEquipe } from '@/api/concours';

interface InscrireEquipeDialogProps {
  concoursId: string;
}

export function InscrireEquipeDialog({ concoursId }: InscrireEquipeDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nomEquipe, setNomEquipe] = useState('');
  const [joueurs, setJoueurs] = useState('');
  const [club, setClub] = useState('');
  const [teteDeSerie, setTeteDeSerie] = useState(false);

  const mutation = useMutation({
    mutationFn: () => {
      const joueursList = joueurs.split(',').map((j) => j.trim()).filter(Boolean);
      return inscrireEquipe(concoursId, {
        nomEquipe,
        ...(joueursList.length > 0 && { joueurs: joueursList }),
        ...(club && { club }),
        teteDeSerie,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['concours', concoursId] });
      setOpen(false);
      setNomEquipe('');
      setJoueurs('');
      setClub('');
      setTeteDeSerie(false);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Inscrire une équipe</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inscrire une équipe</DialogTitle>
          <DialogDescription>Ajoutez une équipe au concours.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="nomEquipe">Nom de l'équipe</Label>
            <Input
              id="nomEquipe"
              value={nomEquipe}
              onChange={(e) => setNomEquipe(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="joueurs">Joueurs (séparés par des virgules)</Label>
            <Input
              id="joueurs"
              value={joueurs}
              onChange={(e) => setJoueurs(e.target.value)}
              placeholder="Dupont, Martin, Durand"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="club">Club</Label>
            <Input
              id="club"
              value={club}
              onChange={(e) => setClub(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="teteDeSerie"
              checked={teteDeSerie}
              onCheckedChange={(checked) => setTeteDeSerie(checked === true)}
            />
            <Label htmlFor="teteDeSerie">Tête de série</Label>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Inscription...' : 'Inscrire'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
