import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { InscrireEquipeDialog } from './InscrireEquipeDialog';
import type { ConcoursDetail } from '@/types/concours';

interface InscriptionsTabProps {
  concours: ConcoursDetail;
}

export function InscriptionsTab({ concours }: InscriptionsTabProps) {
  const canInscrire = concours.statut === 'INSCRIPTIONS_OUVERTES';

  return (
    <div className="space-y-4">
      {canInscrire && (
        <div className="flex justify-end">
          <InscrireEquipeDialog concoursId={concours.id} />
        </div>
      )}

      {concours.inscriptions.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">Aucune inscription.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Équipe</TableHead>
              <TableHead>Joueurs</TableHead>
              <TableHead>Club</TableHead>
              <TableHead>Tête de série</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {concours.inscriptions.map((insc) => (
              <TableRow key={insc.id}>
                <TableCell className="font-medium">{insc.nomEquipe}</TableCell>
                <TableCell>{insc.joueurs.join(', ')}</TableCell>
                <TableCell>{insc.club}</TableCell>
                <TableCell>
                  {insc.teteDeSerie && <Badge variant="secondary">TdS</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
