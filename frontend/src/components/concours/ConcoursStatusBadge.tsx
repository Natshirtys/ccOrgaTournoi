import { cn } from '@/lib/utils';
import type { StatutConcours } from '@/types/concours';

const statutConfig: Record<StatutConcours, { label: string; className: string }> = {
  BROUILLON:             { label: 'Brouillon',             className: 'bg-muted text-muted-foreground border border-border' },
  INSCRIPTIONS_OUVERTES: { label: 'Inscriptions ouvertes', className: 'bg-success/10 text-success border border-success/30' },
  INSCRIPTIONS_CLOSES:   { label: 'Inscriptions closes',   className: 'bg-orange-50 text-orange-600 border border-orange-200' },
  TIRAGE_EN_COURS:       { label: 'Tirage en cours',       className: 'bg-secondary text-secondary-foreground border border-primary/20' },
  EN_COURS:              { label: 'En cours',              className: 'bg-primary/10 text-primary border border-primary/30' },
  TERMINE:               { label: 'Terminé',               className: 'bg-muted text-muted-foreground border border-border' },
  ARCHIVE:               { label: 'Archivé',               className: 'bg-muted/50 text-muted-foreground/70 border border-border/50' },
};

export function ConcoursStatusBadge({ statut }: { statut: string }) {
  const config = statutConfig[statut as StatutConcours] ?? { label: statut, className: 'bg-muted text-muted-foreground border border-border' };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  );
}
