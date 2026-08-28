import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { modifierInscription } from '@/api/concours';
import type { InscriptionDto } from '@/types/concours';

interface ModifierEquipeDialogProps {
  concoursId: string;
  inscription: InscriptionDto;
  joueursAttendus: number;
}

export function ModifierEquipeDialog({
  concoursId,
  inscription,
  joueursAttendus,
}: ModifierEquipeDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nomEquipe, setNomEquipe] = useState(inscription.nomEquipe);
  const [joueurs, setJoueurs] = useState((inscription.joueurs ?? []).join(', '));
  const [club, setClub] = useState(inscription.club ?? '');
  const [teteDeSerie, setTeteDeSerie] = useState(inscription.teteDeSerie);
  const [validationError, setValidationError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => modifierInscription(concoursId, inscription.id, {
      nomEquipe,
      joueurs: joueurs.split(',').map((joueur) => joueur.trim()).filter(Boolean),
      club,
      teteDeSerie,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['concours', concoursId] });
      queryClient.invalidateQueries({ queryKey: ['concours'] });
      setOpen(false);
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setNomEquipe(inscription.nomEquipe);
      setJoueurs((inscription.joueurs ?? []).join(', '));
      setClub(inscription.club ?? '');
      setTeteDeSerie(inscription.teteDeSerie);
      setValidationError(null);
      mutation.reset();
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const joueursList = joueurs.split(',').map((joueur) => joueur.trim()).filter(Boolean);
    if (joueursList.length > 0 && joueursList.length !== joueursAttendus) {
      setValidationError(
        `Cette formule attend exactement ${joueursAttendus} joueur${joueursAttendus > 1 ? 's' : ''}.`,
      );
      return;
    }
    setValidationError(null);
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="icon-xs" variant="ghost" title="Modifier l'équipe">
          <Pencil />
          <span className="sr-only">Modifier {inscription.nomEquipe}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier l’équipe</DialogTitle>
          <DialogDescription>Corrigez les informations avant la clôture des inscriptions.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor={`nom-equipe-${inscription.id}`}>Nom de l’équipe</Label>
            <Input
              id={`nom-equipe-${inscription.id}`}
              value={nomEquipe}
              onChange={(event) => setNomEquipe(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`joueurs-${inscription.id}`}>
              Joueurs <span className="text-xs text-muted-foreground">(optionnel, {joueursAttendus} attendu{joueursAttendus > 1 ? 's' : ''})</span>
            </Label>
            <Input
              id={`joueurs-${inscription.id}`}
              value={joueurs}
              onChange={(event) => setJoueurs(event.target.value)}
              placeholder="Dupont, Martin, Durand"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`club-${inscription.id}`}>Club</Label>
            <Input
              id={`club-${inscription.id}`}
              value={club}
              onChange={(event) => setClub(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id={`tete-serie-${inscription.id}`}
              checked={teteDeSerie}
              onCheckedChange={(checked) => setTeteDeSerie(checked === true)}
            />
            <Label htmlFor={`tete-serie-${inscription.id}`}>Tête de série</Label>
          </div>
          <ActionError error={validationError ?? mutation.error} />
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
