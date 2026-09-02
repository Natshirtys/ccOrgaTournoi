import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ActionError } from '@/components/ui/action-error';
import { definirParticipantMeleeActif, inscrireParticipantMelee, modifierParticipantMelee, supprimerParticipantMelee } from '@/api/concours';
import type { ConcoursDetail, ParticipantMeleeDto, PosteMelee } from '@/types/concours';
import { ClubPlayerPickerDialog } from '@/components/club/ClubPlayerPickerDialog';

const POSTE_LABELS: Record<PosteMelee, string> = {
  POINTEUR: 'Pointeur',
  TIREUR: 'Tireur',
  POLYVALENT: 'Polyvalent',
};

function ParticipantDialog({ concoursId, participant }: { concoursId: string; participant?: ParticipantMeleeDto }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nom, setNom] = useState(participant?.nom ?? '');
  const [poste, setPoste] = useState<PosteMelee>(participant?.poste ?? 'POLYVALENT');
  const mutation = useMutation({
    mutationFn: () => participant
      ? modifierParticipantMelee(concoursId, participant.id, { nom, poste })
      : inscrireParticipantMelee(concoursId, { nom, poste }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['concours', concoursId] });
      queryClient.invalidateQueries({ queryKey: ['concours'] });
      setOpen(false);
      if (!participant) { setNom(''); setPoste('POLYVALENT'); }
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {participant ? (
          <Button variant="ghost" size="icon-xs" title={`Modifier ${participant.nom}`}><Pencil /></Button>
        ) : (
          <Button className="h-10 gap-2 sm:h-9"><UserPlus className="h-4 w-4" />Ajouter un joueur</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{participant ? 'Modifier le joueur' : 'Ajouter un joueur'}</DialogTitle></DialogHeader>
        <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
          <div className="grid gap-2"><Label htmlFor="participant-nom">Nom</Label><Input id="participant-nom" value={nom} onChange={(event) => setNom(event.target.value)} required /></div>
          <div className="grid gap-2">
            <Label>Poste préférentiel</Label>
            <Select value={poste} onValueChange={(value) => setPoste(value as PosteMelee)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="POINTEUR">Pointeur</SelectItem>
                <SelectItem value="TIREUR">Tireur</SelectItem>
                <SelectItem value="POLYVALENT">Polyvalent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ActionError error={mutation.error} />
          <DialogFooter><Button type="submit" disabled={mutation.isPending}>{participant ? 'Enregistrer' : 'Ajouter'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MeleeParticipantsTab({ concours, readOnly = false }: { concours: ConcoursDetail; readOnly?: boolean }) {
  const queryClient = useQueryClient();
  const canEdit = !readOnly && concours.statut === 'INSCRIPTIONS_OUVERTES';
  const canToggle = !readOnly && (concours.statut === 'INSCRIPTIONS_OUVERTES'
    || (concours.statut === 'EN_COURS' && concours.formule.typePhase === 'MELEE_TOURNANTE'));
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['concours', concours.id] });
    queryClient.invalidateQueries({ queryKey: ['concours'] });
  };
  const toggleMutation = useMutation({ mutationFn: ({ id, actif }: { id: string; actif: boolean }) => definirParticipantMeleeActif(concours.id, id, actif), onSuccess: invalidate });
  const deleteMutation = useMutation({ mutationFn: (id: string) => supprimerParticipantMelee(concours.id, id), onSuccess: invalidate });
  const actifs = concours.participantsMelee.filter((participant) => participant.actif).length;
  const multiple = concours.formule.typeEquipe === 'DOUBLETTE' ? 4 : 6;
  const compatible = actifs >= multiple && actifs % multiple === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" /><span><strong className="text-foreground">{actifs}</strong> joueur{actifs > 1 ? 's' : ''} disponible{actifs > 1 ? 's' : ''}</span>
        </div>
        {canEdit && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <ClubPlayerPickerDialog
              excludedNames={concours.participantsMelee.map((participant) => participant.nom)}
              onSelect={async (joueurs) => {
                for (const joueur of joueurs) {
                  await inscrireParticipantMelee(concours.id, { nom: joueur.nom, poste: joueur.poste });
                }
                invalidate();
              }}
            />
            <ParticipantDialog concoursId={concours.id} />
          </div>
        )}
      </div>
      {!compatible && concours.participantsMelee.length > 0 && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          Il faut un nombre de joueurs multiple de {multiple} pour former des matchs complets en {concours.formule.typeEquipe === 'DOUBLETTE' ? 'doublette' : 'triplette'}.
        </p>
      )}
      <ActionError error={toggleMutation.error ?? deleteMutation.error} />
      {concours.participantsMelee.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/20 py-14 text-center text-sm text-muted-foreground">Aucun joueur inscrit.</div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {concours.participantsMelee.map((participant, index) => (
            <div key={participant.id} className={`flex items-center gap-3 rounded-xl border bg-card px-4 py-3 ${participant.actif ? '' : 'opacity-55'}`}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">{index + 1}</span>
              <div className="min-w-0 flex-1"><p className="truncate font-semibold">{participant.nom}</p><Badge variant="outline" className="mt-1">{POSTE_LABELS[participant.poste]}</Badge></div>
              {canToggle && <Switch checked={participant.actif} onCheckedChange={(actif) => toggleMutation.mutate({ id: participant.id, actif })} aria-label={`Disponibilité de ${participant.nom}`} />}
              {canEdit && <ParticipantDialog concoursId={concours.id} participant={participant} />}
              {canEdit && <Button variant="ghost" size="icon-xs" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(participant.id)} title={`Retirer ${participant.nom}`}><Trash2 /></Button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
