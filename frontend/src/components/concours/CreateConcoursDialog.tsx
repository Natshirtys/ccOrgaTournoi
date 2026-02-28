import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CreateConcoursPayload, TypeEquipe, TypePhase } from '@/types/concours';

interface CreateConcoursDialogProps {
  onSubmit: (payload: CreateConcoursPayload) => void;
  isPending: boolean;
}

export function CreateConcoursDialog({ onSubmit, isPending }: CreateConcoursDialogProps) {
  const [open, setOpen] = useState(false);
  const [nom, setNom] = useState('');
  const [lieu, setLieu] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [typeEquipe, setTypeEquipe] = useState<TypeEquipe>('DOUBLETTE');
  const [typePhase, setTypePhase] = useState<TypePhase>('POULES');
  const [nbTerrains, setNbTerrains] = useState(8);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      nom,
      dateDebut,
      lieu: lieu || undefined,
      organisateurId: 'org-1',
      typeEquipe,
      typePhase,
      nbTerrains,
    });
    setOpen(false);
    setNom('');
    setLieu('');
    setDateDebut('');
    setTypeEquipe('DOUBLETTE');
    setTypePhase('POULES');
    setNbTerrains(8);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nouveau concours</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer un concours</DialogTitle>
          <DialogDescription>Renseignez les informations du concours.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="nom">Nom</Label>
            <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="lieu">
              Lieu <span className="text-xs text-muted-foreground">(optionnel)</span>
            </Label>
            <Input id="lieu" value={lieu} onChange={(e) => setLieu(e.target.value)} placeholder="Boulodrome municipal…" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dateDebut">Date</Label>
            <Input
              id="dateDebut"
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label>Type d'équipe</Label>
            <Select value={typeEquipe} onValueChange={(v) => setTypeEquipe(v as TypeEquipe)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TETE_A_TETE">Tête-à-tête</SelectItem>
                <SelectItem value="DOUBLETTE">Doublette</SelectItem>
                <SelectItem value="TRIPLETTE">Triplette</SelectItem>
                <SelectItem value="QUADRETTE">Quadrette</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Type de phase</Label>
            <Select value={typePhase} onValueChange={(v) => setTypePhase(v as TypePhase)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="POULES">Poule classique</SelectItem>
                <SelectItem value="SYSTEME_SUISSE">Système Suisse (Aurard)</SelectItem>
                <SelectItem value="CHAMPIONNAT">Round Robin</SelectItem>
                <SelectItem value="ELIMINATION_SIMPLE">Élimination directe + complémentaire</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nbTerrains">Nombre de terrains</Label>
            <Input
              id="nbTerrains"
              type="number"
              min={0}
              max={50}
              value={nbTerrains}
              onChange={(e) => setNbTerrains(parseInt(e.target.value, 10) || 0)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Création...' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
