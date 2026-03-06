import { useState } from 'react';
import { MapPin, Calendar, Users, Archive } from 'lucide-react';
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
import { fetchConcoursDetail } from '@/api/concours';
import { fetchMatchs, fetchClassement } from '@/api/matchs';
import { exportArchivePdf } from '@/lib/pdf-export';
import type { ConcoursSummary } from '@/types/concours';

const TYPE_LABELS: Record<string, string> = {
  TETE_A_TETE: 'Tête-à-tête',
  DOUBLETTE: 'Doublette',
  TRIPLETTE: 'Triplette',
  QUADRETTE: 'Quadrette',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDates(debut: string, fin: string) {
  const d = formatDate(debut);
  const f = formatDate(fin);
  return debut === fin ? d : `${d} – ${f}`;
}

interface ArchivesTabProps {
  archives: ConcoursSummary[];
  onSupprimer?: (id: string) => void;
  onSelectConcours?: (id: string) => void;
}

export function ArchivesTab({ archives, onSupprimer, onSelectConcours }: ArchivesTabProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleExportPdf(id: string) {
    setLoadingId(id);
    try {
      const [concours, matchsRes, classementRes] = await Promise.all([
        fetchConcoursDetail(id),
        fetchMatchs(id),
        fetchClassement(id),
      ]);

      const equipeLookup = new Map<string, string>();
      for (const insc of concours.inscriptions) {
        equipeLookup.set(insc.equipeId, insc.nomEquipe);
      }

      exportArchivePdf(concours, matchsRes.data, classementRes.classement, equipeLookup);
    } finally {
      setLoadingId(null);
    }
  }

  if (archives.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-16">
        <Archive className="mb-2 h-7 w-7 text-muted-foreground/50" />
        <p className="text-sm font-medium text-muted-foreground">Aucun concours archivé</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {archives.map((c) => (
        <div
          key={c.id}
          className={`flex items-center gap-4 rounded-xl border border-border bg-card py-4 pl-5 pr-4 shadow-sm border-l-4 border-l-border opacity-80 ${onSelectConcours ? 'cursor-pointer hover:opacity-100 hover:border-primary/30 transition-all duration-150' : ''}`}
          onClick={onSelectConcours ? () => onSelectConcours(c.id) : undefined}
        >
          {/* Infos */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-base font-semibold text-foreground/70">{c.nom}</span>
              <span className="inline-flex items-center rounded-full border border-border/50 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground/70">
                Archivé
              </span>
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
              <span className="text-foreground/60">
                {TYPE_LABELS[c.formule.typeEquipe] ?? c.formule.typeEquipe}
              </span>
            </div>
          </div>

          {/* Équipes */}
          <div className="hidden shrink-0 flex-col items-center sm:flex">
            <span className="flex items-center gap-1 text-sm font-semibold text-foreground/60">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              {c.nbEquipesInscrites}
            </span>
            <span className="text-[10px] text-muted-foreground">équipes</span>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="outline"
              disabled={loadingId === c.id}
              onClick={() => handleExportPdf(c.id)}
            >
              {loadingId === c.id ? 'Génération…' : 'Exporter PDF'}
            </Button>
            {onSupprimer && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                    Supprimer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer définitivement ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Le concours archivé « {c.nom} » sera supprimé définitivement. Cette action est irréversible.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => onSupprimer(c.id)}
                    >
                      Supprimer définitivement
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
