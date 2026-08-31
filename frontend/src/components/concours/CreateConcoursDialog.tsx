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
import { ActionError } from '@/components/ui/action-error';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CreateConcoursPayload, MethodeAppariement, TypeEquipe, TypePhase } from '@/types/concours';

interface CreateConcoursDialogProps {
  onSubmit: (payload: CreateConcoursPayload) => Promise<unknown>;
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
  const [nbParties, setNbParties] = useState(4);
  const [methodeAppariement, setMethodeAppariement] = useState<MethodeAppariement>('ALEATOIRE');
  const [submitError, setSubmitError] = useState<unknown>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    try {
      await onSubmit({
        nom,
        dateDebut,
        lieu: lieu || undefined,
        typeEquipe,
        typePhase,
        nbTerrains,
        nbParties,
        methodeAppariement,
      });
      setOpen(false);
      setNom('');
      setLieu('');
      setDateDebut('');
      setTypeEquipe('DOUBLETTE');
      setTypePhase('POULES');
      setNbTerrains(8);
      setNbParties(4);
      setMethodeAppariement('ALEATOIRE');
    } catch (error) {
      setSubmitError(error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-10 sm:h-9">Nouveau concours</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
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
                {!['MELEE', 'MELEE_TOURNANTE'].includes(typePhase) && <SelectItem value="TETE_A_TETE">Tête-à-tête</SelectItem>}
                <SelectItem value="DOUBLETTE">Doublette</SelectItem>
                <SelectItem value="TRIPLETTE">Triplette</SelectItem>
                {!['MELEE', 'MELEE_TOURNANTE'].includes(typePhase) && <SelectItem value="QUADRETTE">Quadrette</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Type de phase</Label>
            <Select value={typePhase} onValueChange={(v) => {
              const next = v as TypePhase;
              setTypePhase(next);
              if (['MELEE', 'MELEE_TOURNANTE'].includes(next) && !['DOUBLETTE', 'TRIPLETTE'].includes(typeEquipe)) setTypeEquipe('DOUBLETTE');
            }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="POULES">Poule classique</SelectItem>
                <SelectItem value="SYSTEME_SUISSE">Système Suisse (Aurard)</SelectItem>
                <SelectItem value="CHAMPIONNAT">Round Robin</SelectItem>
                <SelectItem value="ELIMINATION_SIMPLE">Élimination directe + complémentaire</SelectItem>
                <SelectItem value="MELEE">À la mêlée (équipes fixes)</SelectItem>
                <SelectItem value="MELEE_TOURNANTE">À la mêlée tournante</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {['MELEE', 'MELEE_TOURNANTE'].includes(typePhase) && (
            <div className="grid gap-4 rounded-xl border border-primary/20 bg-primary/[0.04] p-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="nbParties">Nombre de parties</Label>
                <Input id="nbParties" type="number" min={1} max={50} value={nbParties} onChange={(e) => setNbParties(Number(e.target.value) || 1)} />
              </div>
              {typePhase === 'MELEE' && (
                <div className="grid gap-2">
                  <Label>Appariement</Label>
                  <Select value={methodeAppariement} onValueChange={(value) => setMethodeAppariement(value as MethodeAppariement)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALEATOIRE">Aléatoire</SelectItem>
                      <SelectItem value="SUISSE_STANDARD">Gagnants contre gagnants</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Inscriptions individuelles, postes préférentiels et équipes équilibrées. Aucun match nul.
              </p>
            </div>
          )}
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
          <ActionError error={submitError} />
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
