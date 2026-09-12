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
import { ActionError } from '@/components/ui/action-error';
import { inscrireEquipe } from '@/api/concours';
import { ClubPlayerPickerDialog } from '@/components/club/ClubPlayerPickerDialog';

interface InscrireEquipeDialogProps {
  concoursId: string;
  joueursAttendus: number;
  excludedPlayerNames?: string[];
  isTeteATete?: boolean;
  placesDisponibles?: number;
}

export function InscrireEquipeDialog({
  concoursId,
  joueursAttendus,
  excludedPlayerNames = [],
  isTeteATete = false,
  placesDisponibles,
}: InscrireEquipeDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nomEquipe, setNomEquipe] = useState('');
  const [joueurs, setJoueurs] = useState('');
  const [club, setClub] = useState('');
  const [teteDeSerie, setTeteDeSerie] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const joueursList = joueurs.split(',').map((j) => j.trim()).filter(Boolean);
      if (isTeteATete) {
        for (const joueur of joueursList) {
          await inscrireEquipe(concoursId, {
            nomEquipe: joueur,
            joueurs: [joueur],
            teteDeSerie: false,
          });
        }
        return;
      }
      await inscrireEquipe(concoursId, {
        nomEquipe,
        ...(joueursList.length > 0 && { joueurs: joueursList }),
        ...(club && { club }),
        teteDeSerie,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['concours', concoursId] });
      queryClient.invalidateQueries({ queryKey: ['concours'] });
      setOpen(false);
      setNomEquipe('');
      setJoueurs('');
      setClub('');
      setTeteDeSerie(false);
      setValidationError(null);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const joueursList = joueurs.split(',').map((j) => j.trim()).filter(Boolean);
    if (isTeteATete) {
      if (joueursList.length === 0) {
        setValidationError('Ajoutez au moins un joueur.');
        return;
      }
      const normalises = joueursList.map((joueur) => joueur.toLocaleLowerCase('fr-FR'));
      if (new Set(normalises).size !== normalises.length) {
        setValidationError('Un joueur ne peut pas être inscrit deux fois.');
        return;
      }
      const dejaInscrits = new Set(excludedPlayerNames.map((joueur) => joueur.toLocaleLowerCase('fr-FR')));
      if (normalises.some((joueur) => dejaInscrits.has(joueur))) {
        setValidationError('Un des joueurs est déjà inscrit à ce concours.');
        return;
      }
      if (placesDisponibles !== undefined && joueursList.length > placesDisponibles) {
        setValidationError(`Il reste seulement ${placesDisponibles} place${placesDisponibles > 1 ? 's' : ''}.`);
        return;
      }
      setValidationError(null);
      mutation.mutate();
      return;
    }
    if (joueursList.length > 0 && joueursList.length !== joueursAttendus) {
      setValidationError(
        `Cette formule attend exactement ${joueursAttendus} joueur${joueursAttendus > 1 ? 's' : ''}.`,
      );
      return;
    }
    setValidationError(null);
    mutation.mutate();
  }

  const joueursSaisis = joueurs.split(',').map((joueur) => joueur.trim()).filter(Boolean);
  const placesRestantes = Math.max(
    0,
    isTeteATete
      ? (placesDisponibles ?? Number.POSITIVE_INFINITY) - joueursSaisis.length
      : joueursAttendus - joueursSaisis.length,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">{isTeteATete ? 'Inscrire des joueurs' : 'Inscrire une équipe'}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isTeteATete ? 'Inscrire des joueurs' : 'Inscrire une équipe'}</DialogTitle>
          <DialogDescription>
            {isTeteATete
              ? 'Chaque joueur sera inscrit individuellement sous son propre nom.'
              : 'Ajoutez une équipe au concours.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          {!isTeteATete && <div className="grid gap-2">
            <Label htmlFor="nomEquipe">Nom de l'équipe</Label>
            <Input
              id="nomEquipe"
              value={nomEquipe}
              onChange={(e) => setNomEquipe(e.target.value)}
              required
            />
          </div>}
          <div className="grid gap-2">
            <Label htmlFor="joueurs">
              {isTeteATete ? 'Joueurs à inscrire' : 'Joueurs'}{' '}
              {!isTeteATete && <span className="text-xs text-muted-foreground">(optionnel, {joueursAttendus} attendu{joueursAttendus > 1 ? 's' : ''})</span>}
            </Label>
            <Input
              id="joueurs"
              value={joueurs}
              onChange={(e) => setJoueurs(e.target.value)}
              placeholder={isTeteATete ? 'Dupont, Martin, Durand…' : 'Dupont, Martin, Durand'}
            />
            {isTeteATete && <p className="text-xs text-muted-foreground">Séparez les noms par une virgule, ou choisissez-les dans le club.</p>}
            {placesRestantes > 0 && (
              <ClubPlayerPickerDialog
                excludedNames={[...excludedPlayerNames, ...joueursSaisis]}
                maxSelection={Number.isFinite(placesRestantes) ? placesRestantes : undefined}
                onSelect={(selection) => {
                  setJoueurs([...joueursSaisis, ...selection.map((joueur) => joueur.nom)].join(', '));
                  setValidationError(null);
                }}
              />
            )}
          </div>
          {!isTeteATete && <div className="grid gap-2">
            <Label htmlFor="club">Club</Label>
            <Input
              id="club"
              value={club}
              onChange={(e) => setClub(e.target.value)}
            />
          </div>}
          {!isTeteATete && <div className="flex items-center gap-2">
            <Checkbox
              id="teteDeSerie"
              checked={teteDeSerie}
              onCheckedChange={(checked) => setTeteDeSerie(checked === true)}
            />
            <Label htmlFor="teteDeSerie">Tête de série</Label>
          </div>}
          <ActionError error={validationError ?? mutation.error} />
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? 'Inscription…'
                : isTeteATete
                  ? `Inscrire${joueursSaisis.length > 0 ? ` ${joueursSaisis.length} joueur${joueursSaisis.length > 1 ? 's' : ''}` : ''}`
                  : 'Inscrire'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
