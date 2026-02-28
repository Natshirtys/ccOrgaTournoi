import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MatchRow } from './MatchRow';
import { PoolGroupCard } from './PoolGroupCard';
import { KnockoutBracket } from './KnockoutBracket';
import { fetchMatchs } from '@/api/matchs';
import { exportFeuillesDeMatch } from '@/lib/pdf-export';
import type { ConcoursDetail, MatchDto, TerrainDto } from '@/types/concours';

const PHASE_LABELS: Record<string, string> = {
  POULES: 'Phase de poules',
  ELIMINATION_SIMPLE: 'Tableau Principal',
  CONSOLANTE: 'Tableau Complémentaire',
  CHAMPIONNAT: 'Phase de poules',
  SYSTEME_SUISSE: 'Système Suisse',
};

// Couleurs des headers par type de phase et nom
function getPhaseHeaderClass(phaseType: string, phaseNom?: string): string {
  if (phaseType === 'CHAMPIONNAT') return 'bg-muted';
  if (phaseType === 'CONSOLANTE') return 'bg-amber-600 text-white';
  if (phaseType === 'ELIMINATION_SIMPLE') {
    if (phaseNom === 'Championnat A') return 'bg-green-700 text-white';
    if (phaseNom === 'Championnat B') return 'bg-blue-700 text-white';
    if (phaseNom === 'Championnat C') return 'bg-orange-600 text-white';
    return 'bg-[var(--color-bracket-bg)] text-white';
  }
  return 'bg-muted';
}

interface MatchsTabProps {
  concours: ConcoursDetail;
}

interface PoolGroup {
  equipeIds: string[];
  matchs: MatchDto[];
}

function reconstructPools(matchs: MatchDto[]): PoolGroup[] {
  // Tour 1 matchs define the pools: each pair of consecutive matchs = 1 poule of 4
  const tour1 = matchs
    .filter((m) => m.tourNumero === 1)
    .sort((a, b) => a.id.localeCompare(b.id));

  const pools: PoolGroup[] = [];

  for (let i = 0; i < tour1.length; i += 2) {
    const m1 = tour1[i];
    const m2 = tour1[i + 1];

    const equipeIds: string[] = [];
    if (m1) equipeIds.push(m1.equipeAId, m1.equipeBId);
    if (m2) equipeIds.push(m2.equipeAId, m2.equipeBId);

    const poolEquipeSet = new Set(equipeIds);
    const poolMatchs = matchs.filter(
      (m) => poolEquipeSet.has(m.equipeAId) && poolEquipeSet.has(m.equipeBId),
    );

    pools.push({ equipeIds, matchs: poolMatchs });
  }

  return pools;
}

export function MatchsTab({ concours }: MatchsTabProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['concours', concours.id, 'matchs'],
    queryFn: () => fetchMatchs(concours.id),
    enabled: concours.statut === 'EN_COURS' || concours.statut === 'TERMINE',
  });

  const equipeLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const insc of concours.inscriptions) {
      map.set(insc.equipeId, insc.nomEquipe);
    }
    return map;
  }, [concours.inscriptions]);

  // Map phaseId → nom depuis concours.phases
  const phaseNomLookup = useMemo(() => {
    const map = new Map<string, string | undefined>();
    for (const p of concours.phases) {
      map.set(p.id, p.nom);
    }
    return map;
  }, [concours.phases]);

  // Grouper par phase puis par tour
  const matchsByPhaseAndTour = useMemo(() => {
    const matchs = data?.data ?? [];
    const phases = new Map<string, { phaseType: string; phaseNom?: string; tours: Map<number, { nom?: string; matchs: MatchDto[] }> }>();

    for (const m of matchs) {
      const phaseId = m.phaseId ?? 'default';
      const phaseType = m.phaseType ?? '';

      if (!phases.has(phaseId)) {
        phases.set(phaseId, { phaseType, phaseNom: phaseNomLookup.get(phaseId), tours: new Map() });
      }

      const phase = phases.get(phaseId)!;
      const tourNum = m.tourNumero;

      if (!phase.tours.has(tourNum)) {
        phase.tours.set(tourNum, { nom: m.tourNom, matchs: [] });
      }
      phase.tours.get(tourNum)!.matchs.push(m);
    }

    return Array.from(phases.entries()).map(([phaseId, { phaseType, phaseNom, tours }]) => ({
      phaseId,
      phaseType,
      phaseNom,
      tours: Array.from(tours.entries())
        .sort(([a], [b]) => a - b)
        .map(([tourNum, data]) => ({ tourNum, ...data })),
    }));
  }, [data, phaseNomLookup]);

  // Flat matchs par phase pour les rendus spécialisés
  const matchsByPhase = useMemo(() => {
    const matchs = data?.data ?? [];
    const phases = new Map<string, { phaseType: string; phaseNom?: string; matchs: MatchDto[] }>();

    for (const m of matchs) {
      const phaseId = m.phaseId ?? 'default';
      const phaseType = m.phaseType ?? '';

      if (!phases.has(phaseId)) {
        phases.set(phaseId, { phaseType, phaseNom: phaseNomLookup.get(phaseId), matchs: [] });
      }
      phases.get(phaseId)!.matchs.push(m);
    }

    return phases;
  }, [data, phaseNomLookup]);

  if (isLoading) {
    return <p className="py-8 text-center text-muted-foreground">Chargement des matchs...</p>;
  }

  if (matchsByPhaseAndTour.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">Aucun match.</p>;
  }

  const allMatchs = data?.data ?? [];
  const hasMultiplePhases = matchsByPhaseAndTour.length > 1;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportFeuillesDeMatch(concours, allMatchs, equipeLookup)}
        >
          <FileText className="mr-2 h-4 w-4" />
          Exporter feuilles de match
        </Button>
      </div>
      {matchsByPhaseAndTour.map(({ phaseId, phaseType, phaseNom, tours }) => {
        const phaseData = matchsByPhase.get(phaseId);
        const displayLabel = phaseNom ?? PHASE_LABELS[phaseType] ?? phaseType;
        const headerClass = getPhaseHeaderClass(phaseType, phaseNom);

        return (
          <div key={phaseId} className="space-y-4">
            {hasMultiplePhases && (
              <div className={`rounded-lg px-4 py-2 ${headerClass}`}>
                <h3 className="text-lg font-bold tracking-wide uppercase">
                  {displayLabel}
                </h3>
              </div>
            )}

            {/* Rendu spécialisé Poules GSL */}
            {phaseType === 'POULES' && phaseData ? (
              <PoolsPhaseView
                matchs={phaseData.matchs}
                equipeLookup={equipeLookup}
                concoursId={concours.id}
                mode="gsl"
              />
            ) : /* Rendu spécialisé Championnat (poules round-robin) */
            phaseType === 'CHAMPIONNAT' && phaseData ? (
              <PoolsPhaseView
                matchs={phaseData.matchs}
                equipeLookup={equipeLookup}
                concoursId={concours.id}
                mode="roundrobin"
              />
            ) : /* Rendu spécialisé KO */
            (phaseType === 'ELIMINATION_SIMPLE' || phaseType === 'CONSOLANTE') && phaseData ? (
              <KnockoutBracket
                matchs={phaseData.matchs}
                concoursId={concours.id}
                equipeLookup={equipeLookup}
                variant={phaseType === 'CONSOLANTE' ? 'consolante' : 'principal'}
                phaseId={phaseId}
                terrains={concours.terrains}
              />
            ) : (
              /* Fallback : rendu tableau classique */
              <TablePhaseView
                tours={tours}
                equipeLookup={equipeLookup}
                concoursId={concours.id}
                terrains={concours.terrains}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* --- Sous-composants de rendu --- */

function PoolsPhaseView({
  matchs,
  equipeLookup,
  concoursId,
  mode,
}: {
  matchs: MatchDto[];
  equipeLookup: Map<string, string>;
  concoursId: string;
  mode: 'gsl' | 'roundrobin';
}) {
  const pools = useMemo(() => reconstructPools(matchs), [matchs]);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {pools.map((pool, idx) => (
        <PoolGroupCard
          key={idx}
          pouleIndex={idx}
          equipeIds={pool.equipeIds}
          matchs={pool.matchs}
          equipeLookup={equipeLookup}
          concoursId={concoursId}
          mode={mode}
        />
      ))}
    </div>
  );
}

function TablePhaseView({
  tours,
  equipeLookup,
  concoursId,
  terrains = [],
}: {
  tours: { tourNum: number; nom?: string; matchs: MatchDto[] }[];
  equipeLookup: Map<string, string>;
  concoursId: string;
  terrains?: TerrainDto[];
}) {
  return (
    <>
      {tours.map(({ tourNum, nom, matchs }) => (
        <Card key={tourNum}>
          <CardHeader>
            <CardTitle className="text-lg">
              {nom ?? `Tour ${tourNum}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Équipe A</TableHead>
                  <TableHead className="text-center w-12" />
                  <TableHead>Équipe B</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead>Terrain</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matchs.map((m) => (
                  <MatchRow
                    key={m.id}
                    match={m}
                    concoursId={concoursId}
                    equipeANom={equipeLookup.get(m.equipeAId) ?? m.equipeAId}
                    equipeBNom={equipeLookup.get(m.equipeBId) ?? m.equipeBId}
                    terrains={terrains}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
