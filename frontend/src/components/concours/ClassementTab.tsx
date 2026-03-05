import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { fetchClassement } from '@/api/matchs';
import { exportClassement } from '@/lib/pdf-export';
import type { ConcoursDetail, LigneClassementDto } from '@/types/concours';

interface ClassementTabProps {
  concours: ConcoursDetail;
}

// Médaille + couleurs par rang
const PODIUM: Record<number, { medal: string; border: string; bg: string; badge: string }> = {
  1: {
    medal: '🥇',
    border: 'border-l-amber-400',
    bg: 'bg-amber-50/50 dark:bg-amber-900/20',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-800/50 dark:text-amber-100',
  },
  2: {
    medal: '🥈',
    border: 'border-l-slate-400',
    bg: 'bg-slate-50/50 dark:bg-slate-800/30',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-200',
  },
  3: {
    medal: '🥉',
    border: 'border-l-orange-400',
    bg: 'bg-orange-50/40 dark:bg-orange-900/15',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-800/40 dark:text-orange-200',
  },
};

function RankBadge({ rang, qualifiee }: { rang: number; qualifiee: boolean }) {
  const podium = PODIUM[rang];
  if (podium) {
    return (
      <span
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold',
          podium.badge,
        )}
      >
        {rang}
      </span>
    );
  }
  if (qualifiee) {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded bg-emerald-100 text-[11px] font-bold text-emerald-800 dark:bg-emerald-800/50 dark:text-emerald-200">
        {rang}
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded bg-muted text-[11px] font-bold text-muted-foreground">
      {rang}
    </span>
  );
}

function ClassementRow({
  ligne,
  nom,
  isLast,
}: {
  ligne: LigneClassementDto;
  nom: string;
  isLast: boolean;
}) {
  const podium = PODIUM[ligne.rang];
  const diff = ligne.goalAverage;

  return (
    <div
      className={cn(
        'grid grid-cols-[2rem_1fr_4rem_4rem_5rem_5rem_5.5rem_4.5rem] items-center gap-x-4 border-l-4 px-4 py-2.5 text-sm',
        !isLast && 'border-b border-border/40',
        podium
          ? cn(podium.bg, podium.border)
          : ligne.qualifiee
            ? 'border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-900/15'
            : 'border-l-border bg-background',
      )}
    >
      {/* Rang */}
      <RankBadge rang={ligne.rang} qualifiee={ligne.qualifiee} />

      {/* Équipe */}
      <span className={cn('truncate', podium ? 'font-semibold' : 'font-medium')}>
        {nom}
      </span>

      {/* V */}
      <span className="text-center tabular-nums">{ligne.victoires}</span>

      {/* D */}
      <span className="text-center tabular-nums text-muted-foreground">{ligne.defaites}</span>

      {/* Pm */}
      <span className="text-center tabular-nums text-xs text-emerald-700 dark:text-emerald-400">
        {ligne.pointsMarques}
      </span>

      {/* Pe */}
      <span className="text-center tabular-nums text-xs text-destructive/70">
        {ligne.pointsEncaisses}
      </span>

      {/* Diff */}
      <span
        className={cn(
          'text-center text-xs tabular-nums font-medium',
          diff > 0 ? 'text-emerald-700 dark:text-emerald-400' : diff < 0 ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {diff > 0 ? `+${diff}` : diff}
      </span>

      {/* Pts */}
      <span className="text-center font-bold tabular-nums">{ligne.points}</span>
    </div>
  );
}

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

      <Card className="overflow-hidden shadow-sm">
        {/* Header */}
        <div className="flex items-center bg-primary px-4 py-3">
          <span className="text-sm font-bold tracking-widest text-white uppercase">
            Classement général
          </span>
        </div>

        <CardContent className="p-0">
          {/* En-tête colonnes */}
          <div className="grid grid-cols-[2rem_1fr_4rem_4rem_5rem_5rem_5.5rem_4.5rem] items-center gap-x-4 border-b px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="text-center">#</span>
            <span>Équipe</span>
            <span className="text-center">V</span>
            <span className="text-center">D</span>
            <span className="text-center">Pm</span>
            <span className="text-center">Pe</span>
            <span className="text-center">Diff</span>
            <span className="text-center">Pts</span>
          </div>

          {/* Lignes */}
          {classement.map((ligne, idx) => (
            <ClassementRow
              key={ligne.equipeId}
              ligne={ligne}
              nom={equipeLookup.get(ligne.equipeId) ?? ligne.equipeId}
              isLast={idx === classement.length - 1}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
