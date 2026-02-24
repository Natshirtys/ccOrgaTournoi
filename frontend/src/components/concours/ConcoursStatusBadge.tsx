import { Badge } from '@/components/ui/badge';
import type { StatutConcours } from '@/types/concours';

const statutConfig: Record<StatutConcours, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  BROUILLON:            { label: 'Brouillon',            variant: 'outline' },
  INSCRIPTIONS_OUVERTES:{ label: 'Inscriptions ouvertes', variant: 'default' },
  INSCRIPTIONS_CLOSES:  { label: 'Inscriptions closes',   variant: 'secondary' },
  TIRAGE_EN_COURS:      { label: 'Tirage en cours',       variant: 'secondary' },
  EN_COURS:             { label: 'En cours',              variant: 'default' },
  TERMINE:              { label: 'Terminé',               variant: 'secondary' },
  ARCHIVE:              { label: 'Archivé',               variant: 'outline' },
  ANNULE:               { label: 'Annulé',                variant: 'destructive' },
};

export function ConcoursStatusBadge({ statut }: { statut: StatutConcours }) {
  const config = statutConfig[statut] ?? { label: statut, variant: 'outline' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
