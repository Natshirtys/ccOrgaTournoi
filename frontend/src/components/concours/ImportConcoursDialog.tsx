import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { importerSauvegardeConcours } from '@/api/concours';
import { ActionError } from '@/components/ui/action-error';
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
import { BACKUP_MAX_SIZE, parseSauvegardeConcours } from '@/lib/concours-backup';
import type { SauvegardeConcours } from '@/types/concours';

export function ImportConcoursDialog() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [sauvegarde, setSauvegarde] = useState<SauvegardeConcours | null>(null);
  const [nomFichier, setNomFichier] = useState('');
  const [remplacer, setRemplacer] = useState(false);
  const [fileError, setFileError] = useState<Error | null>(null);

  const mutation = useMutation({
    mutationFn: () => importerSauvegardeConcours(sauvegarde!, remplacer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['concours'] });
      setOpen(false);
      reset();
    },
  });

  function reset() {
    setSauvegarde(null);
    setNomFichier('');
    setRemplacer(false);
    setFileError(null);
    mutation.reset();
    if (inputRef.current) inputRef.current.value = '';
  }

  async function handleFile(file?: File) {
    reset();
    if (!file) return;
    setNomFichier(file.name);

    try {
      if (file.size > BACKUP_MAX_SIZE) {
        throw new Error('Le fichier dépasse la taille maximale de 1 Mo.');
      }
      setSauvegarde(parseSauvegardeConcours(await file.text()));
    } catch (error) {
      setFileError(error instanceof Error ? error : new Error('Le fichier JSON est invalide.'));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="h-10 gap-2 sm:h-9">
          <Upload className="h-4 w-4" />
          Importer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Restaurer un concours</DialogTitle>
          <DialogDescription>
            Sélectionnez une sauvegarde JSON exportée depuis cette application.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="concours-backup">Fichier de sauvegarde</Label>
            <Input
              ref={inputRef}
              id="concours-backup"
              type="file"
              accept="application/json,.json"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
            {sauvegarde && (
              <p className="text-xs text-muted-foreground">{nomFichier} est prêt à être importé.</p>
            )}
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="remplacer-concours"
              checked={remplacer}
              onCheckedChange={(checked) => setRemplacer(checked === true)}
            />
            <Label htmlFor="remplacer-concours" className="leading-snug">
              Remplacer le concours s’il existe déjà
            </Label>
          </div>

          <ActionError error={fileError ?? mutation.error} />
        </div>

        <DialogFooter>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!sauvegarde || mutation.isPending}
          >
            {mutation.isPending ? 'Import en cours…' : 'Importer la sauvegarde'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
