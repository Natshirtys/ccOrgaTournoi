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
                      <span className="text-xs text-muted-foreground">{t.actif ? 'Actif' : 'Arrêté'}</span>
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
      )}
    </div>
  );
}
