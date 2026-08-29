import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ActionError } from '@/components/ui/action-error';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { modifierDisponibiliteTerrain } from '@/api/concours';
import type { ConcoursDetail } from '@/types/concours';

interface TerrainsTabProps {
  concours: ConcoursDetail;
  readOnly?: boolean;
}

export function TerrainsTab({ concours, readOnly = false }: TerrainsTabProps) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ terrainId, actif }: { terrainId: string; actif: boolean }) =>
      modifierDisponibiliteTerrain(concours.id, terrainId, actif),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['concours', concours.id] });
      queryClient.invalidateQueries({ queryKey: ['concours', concours.id, 'matchs'] });
    },
  });

  return (
    <div className="space-y-4">
      <ActionError error={mutation.error} />
      {concours.terrains.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">Aucun terrain.</p>
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {concours.terrains.map((t) => (
              <article
                key={t.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {t.numero}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">{t.nom}</p>
                  <Badge variant={t.disponible ? 'default' : 'secondary'}>
                    {!t.actif ? 'Hors service' : t.occupe ? 'Occupé' : 'Disponible'}
                  </Badge>
                </div>
                {!readOnly && (
                  <label
                    htmlFor={`terrain-actif-${t.id}`}
                    className="flex min-h-11 shrink-0 cursor-pointer flex-col items-end justify-center gap-1 pl-2"
                  >
                    <span className="text-[11px] text-muted-foreground">
                      {t.actif ? 'En service' : 'À l’arrêt'}
                    </span>
                      <Switch
                        id={`terrain-actif-${t.id}`}
                        checked={t.actif}
                        disabled={mutation.isPending && mutation.variables?.terrainId === t.id}
                        aria-label={`${t.actif ? 'Mettre hors service' : 'Remettre en service'} ${t.nom}`}
                        onCheckedChange={(actif) => mutation.mutate({ terrainId: t.id, actif })}
                      />
                  </label>
                )}
              </article>
            ))}
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Disponible</TableHead>
                  {!readOnly && <TableHead className="text-right">En service</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {concours.terrains.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.numero}</TableCell>
                    <TableCell>{t.nom}</TableCell>
                    <TableCell>
                      <Badge variant={t.disponible ? 'default' : 'secondary'}>
                        {!t.actif ? 'Hors service' : t.occupe ? 'Occupé' : 'Disponible'}
                      </Badge>
                    </TableCell>
                    {!readOnly && (
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {t.actif ? 'Actif' : 'Arrêté'}
                          </span>
                          <Switch
                            checked={t.actif}
                            disabled={mutation.isPending && mutation.variables?.terrainId === t.id}
                            aria-label={`${t.actif ? 'Mettre hors service' : 'Remettre en service'} ${t.nom}`}
                            onCheckedChange={(actif) => mutation.mutate({ terrainId: t.id, actif })}
                          />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
