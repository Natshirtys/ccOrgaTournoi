import { Users, Building2, Star, UserRound } from 'lucide-react';
import { InscrireEquipeDialog } from './InscrireEquipeDialog';
import { cn } from '@/lib/utils';
import type { ConcoursDetail } from '@/types/concours';

interface InscriptionsTabProps {
  concours: ConcoursDetail;
  readOnly?: boolean;
}

export function InscriptionsTab({ concours, readOnly = false }: InscriptionsTabProps) {
  const canInscrire = !readOnly && concours.statut === 'INSCRIPTIONS_OUVERTES';
  const inscriptions = concours.inscriptions;

  return (
    <div className="space-y-4">
      {/* Header barre */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>
            <span className="font-semibold text-foreground">{inscriptions.length}</span>
            {' '}équipe{inscriptions.length > 1 ? 's' : ''} inscrite{inscriptions.length > 1 ? 's' : ''}
            {concours.formule.nbEquipesMax > 0 && (
              <span className="text-muted-foreground/70"> / {concours.formule.nbEquipesMax} max</span>
            )}
          </span>
        </div>
        {canInscrire && <InscrireEquipeDialog concoursId={concours.id} />}
      </div>

      {/* État vide */}
      {inscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-16">
          <UserRound className="mb-2 h-7 w-7 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">Aucune équipe inscrite</p>
          {canInscrire && (
            <p className="mt-1 text-xs text-muted-foreground/70">
              Utilisez le bouton ci-dessus pour inscrire la première équipe.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {inscriptions.map((insc, idx) => (
            <div
              key={insc.id}
              className={cn(
                'flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 shadow-sm',
                insc.teteDeSerie && 'border-l-4 border-l-primary',
              )}
            >
              {/* Numéro */}
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                {idx + 1}
              </span>

              {/* Nom équipe */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold text-foreground">{insc.nomEquipe}</span>
                  {insc.teteDeSerie && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      <Star className="h-2.5 w-2.5 fill-current" />
                      Tête de série
                    </span>
                  )}
                </div>

                {/* Joueurs */}
                {insc.joueurs && insc.joueurs.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    {insc.joueurs.map((j) => (
                      <span key={j} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {j}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Club */}
              {insc.club && (
                <div className="hidden shrink-0 items-center gap-1.5 text-sm text-muted-foreground sm:flex">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span>{insc.club}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
