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
import { ajouterTerrain } from '@/api/concours';

interface AjouterTerrainDialogProps {
  concoursId: string;
}

export function AjouterTerrainDialog({ concoursId }: AjouterTerrainDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [numero, setNumero] = useState('');
  const [nom, setNom] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      ajouterTerrain(concoursId, {
        numero: parseInt(numero, 10),
        nom,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['concours', concoursId] });
      setOpen(false);
      setNumero('');
      setNom('');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Ajouter terrain</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un terrain</DialogTitle>
          <DialogDescription>Renseignez les informations du terrain.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="terrainNumero">Numéro</Label>
            <Input
              id="terrainNumero"
              type="number"
              min="1"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="terrainNom">Nom</Label>
            <Input
              id="terrainNom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Ajout...' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
