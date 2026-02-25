import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { ConcoursDetail } from '@/types/concours';

interface TerrainsTabProps {
  concours: ConcoursDetail;
}

export function TerrainsTab({ concours }: TerrainsTabProps) {
  return (
    <div className="space-y-4">
      {concours.terrains.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">Aucun terrain.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Numéro</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Disponible</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {concours.terrains.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.numero}</TableCell>
                <TableCell>{t.nom}</TableCell>
                <TableCell>
                  <Badge variant={t.disponible ? 'default' : 'secondary'}>
                    {t.disponible ? 'Oui' : 'Non'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
