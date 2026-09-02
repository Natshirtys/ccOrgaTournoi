import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Search, Trash2, UserPlus, UsersRound } from 'lucide-react';
import { ajouterJoueurClub, definirJoueurClubActif, fetchJoueursClub, modifierJoueurClub, supprimerJoueurClub } from '@/api/joueurs-club';
import { ActionError } from '@/components/ui/action-error';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { JoueurClubDto, PosteMelee } from '@/types/concours';

const POSTE_LABELS: Record<PosteMelee, string> = { POINTEUR: 'Pointeur', TIREUR: 'Tireur', POLYVALENT: 'Polyvalent' };

function PlayerDialog({ joueur }: { joueur?: JoueurClubDto }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nom, setNom] = useState(joueur?.nom ?? '');
  const [poste, setPoste] = useState<PosteMelee>(joueur?.poste ?? 'POLYVALENT');
  const mutation = useMutation({
    mutationFn: () => joueur ? modifierJoueurClub(joueur.id, { nom, poste }) : ajouterJoueurClub({ nom, poste }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['joueurs-club'] });
      setOpen(false);
      if (!joueur) { setNom(''); setPoste('POLYVALENT'); }
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {joueur ? (
          <Button variant="ghost" size="icon-xs" title={`Modifier ${joueur.nom}`}><Pencil /></Button>
        ) : (
          <Button className="h-10 gap-2 sm:h-9"><UserPlus className="h-4 w-4" />Ajouter un joueur</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{joueur ? 'Modifier le joueur' : 'Ajouter un joueur du club'}</DialogTitle>
          <DialogDescription>Ces informations seront proposées lors des prochaines inscriptions.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
          <div className="grid gap-2"><Label htmlFor={`club-player-${joueur?.id ?? 'new'}`}>Nom</Label><Input id={`club-player-${joueur?.id ?? 'new'}`} value={nom} onChange={(event) => setNom(event.target.value)} required autoFocus /></div>
          <div className="grid gap-2"><Label>Poste de prédilection</Label><Select value={poste} onValueChange={(value) => setPoste(value as PosteMelee)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="POINTEUR">Pointeur</SelectItem><SelectItem value="TIREUR">Tireur</SelectItem><SelectItem value="POLYVALENT">Polyvalent</SelectItem></SelectContent></Select></div>
          <ActionError error={mutation.error} />
          <DialogFooter><Button type="submit" disabled={mutation.isPending}>{joueur ? 'Enregistrer' : 'Ajouter au club'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ClubPlayersPanel() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const { data, isLoading, error } = useQuery({ queryKey: ['joueurs-club'], queryFn: fetchJoueursClub });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['joueurs-club'] });
  const toggleMutation = useMutation({ mutationFn: ({ id, actif }: { id: string; actif: boolean }) => definirJoueurClubActif(id, actif), onSuccess: invalidate });
  const deleteMutation = useMutation({ mutationFn: supprimerJoueurClub, onSuccess: invalidate });
  const joueurs = data?.data ?? [];
  const filtered = joueurs.filter((joueur) => joueur.nom.toLocaleLowerCase('fr-FR').includes(search.trim().toLocaleLowerCase('fr-FR')));
  const actifs = joueurs.filter((joueur) => joueur.actif).length;

  return (
    <section className="space-y-4 rounded-2xl border bg-card/40 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><UsersRound className="h-5 w-5" /></span><div><h3 className="font-bold">Joueurs du club</h3><p className="text-xs text-muted-foreground">{actifs} membre{actifs > 1 ? 's' : ''} actif{actifs > 1 ? 's' : ''} · répertoire pour les inscriptions</p></div></div>
        <PlayerDialog />
      </div>
      <div className="relative max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un membre…" /></div>
      <ActionError error={error ?? toggleMutation.error ?? deleteMutation.error} />
      {isLoading ? <p className="py-12 text-center text-sm text-muted-foreground">Chargement…</p> : filtered.length === 0 ? <div className="rounded-xl border border-dashed py-14 text-center text-sm text-muted-foreground">{joueurs.length === 0 ? 'Aucun joueur dans le répertoire.' : 'Aucun joueur ne correspond à la recherche.'}</div> : (
        <div className="grid gap-2 md:grid-cols-2">
          {filtered.map((joueur) => (
            <div key={joueur.id} className={`flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-opacity ${joueur.actif ? '' : 'opacity-55'}`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{joueur.nom.slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0 flex-1"><p className="truncate font-semibold">{joueur.nom}</p><Badge variant="outline" className="mt-1">{POSTE_LABELS[joueur.poste]}</Badge></div>
              <Switch checked={joueur.actif} onCheckedChange={(actif) => toggleMutation.mutate({ id: joueur.id, actif })} aria-label={`Disponibilité de ${joueur.nom}`} />
              <PlayerDialog joueur={joueur} />
              <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon-xs" className="text-destructive hover:text-destructive" title={`Supprimer ${joueur.nom}`}><Trash2 /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Supprimer ce joueur du répertoire ?</AlertDialogTitle><AlertDialogDescription>« {joueur.nom} » ne sera plus proposé lors des inscriptions. Les concours existants ne seront pas modifiés.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Conserver</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteMutation.mutate(joueur.id)}>Supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
