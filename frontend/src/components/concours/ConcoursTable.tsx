import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ConcoursStatusBadge } from './ConcoursStatusBadge';
import type { ConcoursSummary } from '@/types/concours';

const TYPE_LABELS: Record<string, string> = {
  TETE_A_TETE: 'Tête-à-tête',
  DOUBLETTE: 'Doublette',
  TRIPLETTE: 'Triplette',
  QUADRETTE: 'Quadrette',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR');
}

function formatDates(debut: string, fin: string) {
  return debut === fin ? formatDate(debut) : `${formatDate(debut)} — ${formatDate(fin)}`;
}

interface ConcoursTableProps {
  concours: ConcoursSummary[];
  onOuvrirInscriptions: (id: string) => void;
  onSelectConcours: (id: string) => void;
}

export function ConcoursTable({ concours, onOuvrirInscriptions, onSelectConcours }: ConcoursTableProps) {
  if (concours.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        Aucun concours. Créez-en un pour commencer.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nom</TableHead>
          <TableHead>Lieu</TableHead>
          <TableHead>Dates</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead className="text-right">Équipes</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {concours.map((c) => (
          <TableRow key={c.id} className="cursor-pointer hover:bg-muted" onClick={() => onSelectConcours(c.id)}>
            <TableCell className="font-medium">{c.nom}</TableCell>
            <TableCell>{c.lieu || <span className="text-muted-foreground">—</span>}</TableCell>
            <TableCell>{formatDates(c.dates.debut, c.dates.fin)}</TableCell>
            <TableCell>{TYPE_LABELS[c.formule.typeEquipe] ?? c.formule.typeEquipe}</TableCell>
            <TableCell>
              <ConcoursStatusBadge statut={c.statut} />
            </TableCell>
            <TableCell className="text-right">{c.nbEquipesInscrites}</TableCell>
            <TableCell>
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                {c.statut === 'BROUILLON' && (
                  <Button size="sm" variant="outline" onClick={() => onOuvrirInscriptions(c.id)}>
                    Ouvrir inscriptions
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
