import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fetchClassement } from '@/api/matchs';
import { exportClassement } from '@/lib/pdf-export';
import type { ConcoursDetail, LigneClassementDto } from '@/types/concours';

interface ClassementTabProps {
  concours: ConcoursDetail;
}

const MEDALS = ['🥇', '🥈', '🥉'];
const COLS = 'grid-cols-[3.5rem_1fr_5rem_5rem_5rem_5rem_6rem_5.5rem]';

// ─── En-tête colonne ─────────────────────────────────────────────────────────

function HeaderCell({ children, first = false }: { children: React.ReactNode; first?: boolean }) {
  return (
    <span
      className={cn(
        'text-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground',
        !first && 'border-l border-classement-divider py-1',
      )}
    >
      {children}
    </span>
  );
}

// ─── Ligne de classement ─────────────────────────────────────────────────────

function ClassementRow({
  ligne,
  nom,
  idx,
  total,
}: {
  ligne: LigneClassementDto;
  nom: string;
  idx: number;
  total: number;
}) {
  const isPodium = ligne.rang <= 3;
  const isAfterPodium = ligne.rang === 3 && total > 3;
  const diff = ligne.goalAverage;
  const medal = MEDALS[ligne.rang - 1];

  return (
    <div
      className={cn(
        `grid ${COLS} items-center gap-x-2 px-5 py-3.5`,
        idx % 2 === 0 ? 'bg-classement-row-odd' : 'bg-classement-row-even',
        idx < total - 1 && !isAfterPodium && 'border-b border-classement-divider',
        isAfterPodium && 'border-b-2 border-amber-400/60',
      )}
    >
      {/* Rang */}
      <span className="pr-1 text-right text-base font-bold tabular-nums text-muted-foreground">
        {ligne.rang}.
      </span>

      {/* Équipe + médaille */}
      <span className="flex min-w-0 items-center gap-2">
        {medal && <span className="shrink-0 text-xl leading-none">{medal}</span>}
        <span
          className={cn(
            'truncate text-base font-bold',
            isPodium ? 'text-foreground' : 'text-foreground/80',
          )}
        >
          {nom}
        </span>
      </span>

      {/* V */}
      <span className="text-center text-base font-semibold tabular-nums text-foreground/90">
        {ligne.victoires}
      </span>

      {/* D */}
      <span className="text-center text-base tabular-nums text-muted-foreground">
        {ligne.defaites}
      </span>

      {/* Pm */}
      <span className="text-center text-base tabular-nums text-foreground/80">
        {ligne.pointsMarques}
      </span>

      {/* Pe */}
      <span className="text-center text-base tabular-nums text-muted-foreground">
        {ligne.pointsEncaisses}
      </span>

      {/* Diff */}
      <span
        className={cn(
          'text-center text-base font-bold tabular-nums',
          diff > 0
            ? 'text-emerald-600 dark:text-emerald-400'
            : diff < 0
              ? 'text-red-600 dark:text-red-400'
              : 'text-muted-foreground',
        )}
      >
        {diff > 0 ? `+${diff}` : diff}
      </span>

      {/* Pts */}
      <span className="text-center text-lg font-black tabular-nums text-foreground">
        {ligne.points}
      </span>
    </div>
  );
}

// ─── Composant principal ─────────────────────────────────────────────────────

export function ClassementTab({ concours }: ClassementTabProps) {
  const hasPhases = concours.phases.length > 0;

  const { data, isLoading } = useQuery({
    queryKey: ['concours', concours.id, 'classement'],
    queryFn: () => fetchClassement(concours.id),
    enabled: hasPhases,
  });

  const equipeLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const insc of concours.inscriptions) {
      map.set(insc.equipeId, insc.nomEquipe);
    }
    return map;
  }, [concours.inscriptions]);

  if (!hasPhases) {
    return <p className="py-8 text-center text-muted-foreground">Pas de phase en cours.</p>;
  }
  if (isLoading) {
    return <p className="py-8 text-center text-muted-foreground">Chargement du classement...</p>;
  }

  const classement = data?.classement ?? [];

  if (classement.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">Classement non disponible.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Bouton export */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportClassement(concours, classement, equipeLookup)}
        >
          <Download className="mr-2 h-4 w-4" />
          Exporter classement
        </Button>
      </div>

      {/* Panneau principal — couleurs via CSS variables */}
      <div className="overflow-hidden rounded-2xl shadow-xl bg-classement-bg">

        {/* Titre */}
        <div className="px-6 pb-4 pt-6 text-center bg-classement-bg">
          <h2 className="text-2xl font-black tracking-[0.2em] uppercase text-foreground">
            🏆 Classement
          </h2>
          <div className="mt-3 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        </div>

        {/* En-têtes colonnes */}
        <div className={`grid ${COLS} items-center gap-x-2 px-5 pb-2 pt-1 bg-classement-bg`}>
          <span className="pr-1 text-right text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            #
          </span>
          <HeaderCell first>Équipe</HeaderCell>
          <HeaderCell>V</HeaderCell>
          <HeaderCell>D</HeaderCell>
          <HeaderCell>Pm</HeaderCell>
          <HeaderCell>Pe</HeaderCell>
          <HeaderCell>Diff</HeaderCell>
          <HeaderCell>Pts</HeaderCell>
        </div>

        {/* Séparateur sous les headers */}
        <div className="mx-5 mb-0.5 h-px bg-classement-divider" />

        {/* Lignes */}
        {classement.map((ligne, idx) => (
          <ClassementRow
            key={ligne.equipeId}
            ligne={ligne}
            nom={equipeLookup.get(ligne.equipeId) ?? ligne.equipeId}
            idx={idx}
            total={classement.length}
          />
        ))}

        {/* Espace bas */}
        <div className="h-2 bg-classement-row-even" />
      </div>
    </div>
  );
}
