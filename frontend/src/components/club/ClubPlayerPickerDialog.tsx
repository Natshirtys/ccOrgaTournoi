import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, UserRoundCheck } from 'lucide-react';
import { fetchJoueursClub } from '@/api/joueurs-club';
import { ActionError } from '@/components/ui/action-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { JoueurClubDto, PosteMelee } from '@/types/concours';

const POSTE_LABELS: Record<PosteMelee, string> = {
  POINTEUR: 'Pointeur',
  TIREUR: 'Tireur',
  POLYVALENT: 'Polyvalent',
};

interface ClubPlayerPickerDialogProps {
  excludedNames?: string[];
  maxSelection?: number;
  onSelect: (joueurs: JoueurClubDto[]) => void | Promise<void>;
}

export function ClubPlayerPickerDialog({
  excludedNames = [],
  maxSelection,
  onSelect,
}: ClubPlayerPickerDialogProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [selectionError, setSelectionError] = useState<unknown>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['joueurs-club'],
    queryFn: fetchJoueursClub,
    enabled: open,
  });
  const excluded = useMemo(
    () => new Set(excludedNames.map((nom) => nom.trim().toLocaleLowerCase('fr-FR'))),
    [excludedNames],
  );
  const disponibles = (data?.data ?? []).filter((joueur) =>
    joueur.actif && !excluded.has(joueur.nom.toLocaleLowerCase('fr-FR')),
  );
  const filtered = disponibles.filter((joueur) =>
    joueur.nom.toLocaleLowerCase('fr-FR').includes(search.trim().toLocaleLowerCase('fr-FR')),
  );

  function toggle(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) {
        if (maxSelection !== undefined && next.size >= maxSelection) return current;
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  async function confirm() {
    const joueurs = disponibles.filter((joueur) => selectedIds.has(joueur.id));
    setIsSaving(true);
    setSelectionError(null);
    try {
      await onSelect(joueurs);
      setOpen(false);
      setSelectedIds(new Set());
      setSearch('');
    } catch (error) {
      setSelectionError(error);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-10 gap-2 sm:h-9">
          <UserRoundCheck className="h-4 w-4" />Choisir dans le club
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Choisir des joueurs du club</DialogTitle>
          <DialogDescription>
            Sélectionnez les membres à inscrire à ce concours.
            {maxSelection !== undefined && ` ${maxSelection} joueur${maxSelection > 1 ? 's' : ''} maximum.`}
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Rechercher un joueur…" />
        </div>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
          {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Chargement…</p>}
          {!isLoading && filtered.length === 0 && (
            <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
              Aucun joueur disponible.
            </p>
          )}
          {filtered.map((joueur) => {
            const checked = selectedIds.has(joueur.id);
            const limitReached = maxSelection !== undefined && selectedIds.size >= maxSelection && !checked;
            return (
              <label key={joueur.id} className="flex cursor-pointer items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:border-primary/50 hover:bg-primary/[0.03]">
                <Checkbox checked={checked} disabled={limitReached} onCheckedChange={(value) => toggle(joueur.id, value === true)} />
                <span className="min-w-0 flex-1 truncate font-medium">{joueur.nom}</span>
                <Badge variant="outline">{POSTE_LABELS[joueur.poste]}</Badge>
              </label>
            );
          })}
        </div>
        <ActionError error={selectionError} />
        <DialogFooter>
          <Button type="button" onClick={confirm} disabled={selectedIds.size === 0 || isSaving}>
            Inscrire {selectedIds.size || ''} joueur{selectedIds.size > 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
