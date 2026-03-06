import { MapPin, Calendar, Users, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ConcoursStatusBadge } from './ConcoursStatusBadge';
import { cn } from '@/lib/utils';
import type { ConcoursSummary } from '@/types/concours';

const TYPE_LABELS: Record<string, string> = {
  TETE_A_TETE: 'Tête-à-tête',
  DOUBLETTE: 'Doublette',
  TRIPLETTE: 'Triplette',
  QUADRETTE: 'Quadrette',
};

const STATUT_BORDER: Record<string, string> = {
  BROUILLON: 'border-l-border',
  INSCRIPTIONS_OUVERTES: 'border-l-success',
  INSCRIPTIONS_CLOSES: 'border-l-orange-400',
  TIRAGE_EN_COURS: 'border-l-secondary-foreground',
  EN_COURS: 'border-l-primary',
  TERMINE: 'border-l-muted-foreground',
  ARCHIVE: 'border-l-border',
};

const STATUTS_SUPPRESSIBLES = ['BROUILLON', 'INSCRIPTIONS_OUVERTES', 'INSCRIPTIONS_CLOSES', 'TIRAGE_EN_COURS', 'TERMINE'];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDates(debut: string, fin: string) {
  const d = formatDate(debut);
  const f = formatDate(fin);
  return debut === fin ? d : `${d} – ${f}`;
}

interface ConcoursTableProps {
  concours: ConcoursSummary[];
  onOuvrirInscriptions?: (id: string) => void;
  onSelectConcours: (id: string) => void;
  onArchiver?: (id: string) => void;
  onSupprimer?: (id: string) => void;
}

export function ConcoursTable({ concours, onOuvrirInscriptions, onSelectConcours, onArchiver, onSupprimer }: ConcoursTableProps) {
  if (concours.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-16">
        <p className="text-sm font-medium text-muted-foreground">Aucun concours actif</p>
        <p className="mt-1 text-xs text-muted-foreground/70">Créez votre premier concours pour commencer.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {concours.map((c) => (
        <div
          key={c.id}
          className={cn(
            'group relative flex cursor-pointer items-center gap-4 rounded-xl border border-border bg-card py-4 pl-5 pr-4 shadow-sm transition-all duration-150 hover:shadow-md hover:border-primary/30 border-l-4',
            STATUT_BORDER[c.statut] ?? 'border-l-border',
          )}
          onClick={() => onSelectConcours(c.id)}
        >
          {/* Infos principales */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                {c.nom}
              </span>
              <ConcoursStatusBadge statut={c.statut} />
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {c.lieu && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {c.lieu}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3 shrink-0" />
                {formatDates(c.dates.debut, c.dates.fin)}
              </span>
              <span className="font-medium text-foreground/70">
                {TYPE_LABELS[c.formule.typeEquipe] ?? c.formule.typeEquipe}
              </span>
            </div>
          </div>

          {/* Équipes */}
          <div className="hidden shrink-0 flex-col items-center sm:flex">
            <span className="flex items-center gap-1 text-sm font-semibold text-foreground">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              {c.nbEquipesInscrites}
            </span>
            <span className="text-[10px] text-muted-foreground">équipes</span>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {c.statut === 'BROUILLON' && onOuvrirInscriptions && (
              <Button size="sm" variant="outline" onClick={() => onOuvrirInscriptions(c.id)}>
                Ouvrir inscriptions
              </Button>
            )}
            {c.statut === 'TERMINE' && onArchiver && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline">Archiver</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Archiver ce concours ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Le concours « {c.nom} » sera archivé. Cette action est irréversible.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onArchiver(c.id)}>Archiver</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {STATUTS_SUPPRESSIBLES.includes(c.statut) && onSupprimer && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                    Supprimer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer ce concours ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Le concours « {c.nom} » sera supprimé définitivement. Cette action est irréversible.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => onSupprimer(c.id)}
                    >
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
          </div>
        </div>
      ))}
    </div>
  );
}
