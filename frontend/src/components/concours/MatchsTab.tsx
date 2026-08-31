import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Play, Shuffle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActionError } from '@/components/ui/action-error';
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
import { demarrerTousLesMatchs, fetchMatchs, refaireTirageMelee } from '@/api/matchs';
import type { ConcoursDetail, MatchDto, TerrainDto } from '@/types/concours';

const PHASE_LABELS: Record<string, string> = {
  POULES: 'Phase de poules',
  ELIMINATION_SIMPLE: 'Tableau Principal',
  CONSOLANTE: 'Tableau Complémentaire',
  CHAMPIONNAT: 'Phase de poules',
  SYSTEME_SUISSE: 'Système Suisse',
  MELEE: 'Mêlée — équipes fixes',
  MELEE_TOURNANTE: 'Mêlée tournante',
};

// Un fin accent conserve l'identité A/B/C sans transformer le titre en bandeau massif.
function getPhaseHeaderClass(phaseType: string, phaseNom?: string): string {
  if (phaseType === 'CHAMPIONNAT') return 'border-l-primary bg-primary/[0.04]';
  if (phaseType === 'CONSOLANTE') return 'border-l-amber-500 bg-amber-500/[0.06]';
  if (phaseType === 'ELIMINATION_SIMPLE') {
    if (phaseNom === 'Championnat A') return 'border-l-emerald-500 bg-emerald-500/[0.06]';
    if (phaseNom === 'Championnat B') return 'border-l-blue-500 bg-blue-500/[0.06]';
    if (phaseNom === 'Championnat C') return 'border-l-orange-500 bg-orange-500/[0.06]';
    return 'border-l-primary bg-primary/[0.04]';
  }
  return 'border-l-muted-foreground bg-muted/40';
}

interface MatchsTabProps {
  concours: ConcoursDetail;
  readOnly?: boolean;
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
    if (m1) equipeIds.push(m1.equipeAId, ...(m1.equipeBId ? [m1.equipeBId] : []));
    if (m2) equipeIds.push(m2.equipeAId, ...(m2.equipeBId ? [m2.equipeBId] : []));

    const poolEquipeSet = new Set(equipeIds);
    const poolMatchs = matchs.filter(
      (m) =>
        m.equipeBId !== null &&
        poolEquipeSet.has(m.equipeAId) &&
        poolEquipeSet.has(m.equipeBId),
    );

    pools.push({ equipeIds, matchs: poolMatchs });
  }

  return pools;
}

export function MatchsTab({ concours, readOnly = false }: MatchsTabProps) {
  const queryClient = useQueryClient();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<unknown>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['concours', concours.id, 'matchs'],
    queryFn: () => fetchMatchs(concours.id),
    enabled: concours.statut === 'EN_COURS' || concours.statut === 'TERMINE' || concours.statut === 'ARCHIVE',
  });
  const allMatchs = data?.data ?? [];
  const terrainsDisponibles = new Set(
    concours.terrains.filter((terrain) => terrain.disponible).map((terrain) => terrain.id),
  );
  const matchsPrets = allMatchs.filter(
    (match) => match.statut === 'PROGRAMME'
      && match.equipeBId !== null
      && match.terrainId !== null
      && terrainsDisponibles.has(match.terrainId),
  );
  const demarrerTousMutation = useMutation({
    mutationFn: () => demarrerTousLesMatchs(concours.id, matchsPrets.map((match) => match.id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['concours', concours.id] }),
  });
  const isMelee = concours.formule.typePhase === 'MELEE' || concours.formule.typePhase === 'MELEE_TOURNANTE';
  const canRedraw = !readOnly && isMelee && allMatchs.length > 0 && allMatchs
    .filter((match) => match.tourNumero === Math.max(...allMatchs.map((item) => item.tourNumero)))
    .every((match) => match.statut === 'PROGRAMME');
  const redrawMutation = useMutation({
    mutationFn: () => refaireTirageMelee(concours.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['concours', concours.id, 'matchs'] }),
  });

  const equipeLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const insc of concours.inscriptions) {
      map.set(insc.equipeId, insc.nomEquipe);
    }
    const participantNames = new Map(concours.participantsMelee.map((participant) => [participant.id, participant.nom]));
    for (const match of data?.data ?? []) {
      if (match.participantIdsEquipeA.length > 0) {
        map.set(match.equipeAId, match.participantIdsEquipeA.map((id) => participantNames.get(id) ?? id).join(' / '));
      }
      if (match.equipeBId && match.participantIdsEquipeB.length > 0) {
        map.set(match.equipeBId, match.participantIdsEquipeB.map((id) => participantNames.get(id) ?? id).join(' / '));
      }
    }
    return map;
  }, [concours.inscriptions, concours.participantsMelee, data]);

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

  const hasMultiplePhases = matchsByPhaseAndTour.length > 1;
  const isRoundRobin = concours.phases.some((p) => p.type === 'CHAMPIONNAT');

  async function handleExport() {
    setIsExporting(true);
    setExportError(null);
    try {
      const { exportFeuillesDeMatch } = await import('@/lib/pdf-export');
      exportFeuillesDeMatch(concours, allMatchs, equipeLookup);
    } catch (error) {
      setExportError(error);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {canRedraw && (
          <Button variant="outline" className="h-10 w-full gap-2 sm:w-auto" onClick={() => redrawMutation.mutate()} disabled={redrawMutation.isPending}>
            <Shuffle className="h-4 w-4" />Refaire le tirage
          </Button>
        )}
        {!readOnly && matchsPrets.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                className="h-11 w-full cursor-pointer gap-2 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg sm:w-auto"
                disabled={demarrerTousMutation.isPending}
              >
                <Play className="h-4 w-4 fill-current" />
                Tout démarrer
                <span className="rounded-full bg-primary-foreground/15 px-2 py-0.5 text-xs tabular-nums">
                  {matchsPrets.length}
                </span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Démarrer tous les matchs prêts ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Les {matchsPrets.length} matchs ayant un terrain affecté passeront en cours en même temps.
                  Vous pourrez remettre individuellement un match en attente tant qu’aucun score n’est saisi.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Conserver en attente</AlertDialogCancel>
                <AlertDialogAction onClick={() => demarrerTousMutation.mutate()}>
                  Démarrer les {matchsPrets.length} matchs
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-10 w-full sm:h-8 sm:w-auto"
          onClick={handleExport}
          disabled={isExporting}
        >
          <FileText className="mr-2 h-4 w-4" />
          {isExporting ? 'Génération…' : 'Exporter feuilles de match'}
        </Button>
      </div>
      <ActionError error={demarrerTousMutation.error ?? redrawMutation.error ?? exportError} />
      {matchsByPhaseAndTour.map(({ phaseId, phaseType, phaseNom, tours }) => {
        if (isRoundRobin && phaseType === 'CONSOLANTE') return null;
        const phaseData = matchsByPhase.get(phaseId);
        const displayLabel = phaseNom ?? PHASE_LABELS[phaseType] ?? phaseType;
        const headerClass = getPhaseHeaderClass(phaseType, phaseNom);

        return (
          <div key={phaseId} className="space-y-4">
            {hasMultiplePhases && (
              <div className={`rounded-xl border border-l-4 border-border/70 px-4 py-3 shadow-sm ${headerClass}`}>
                <p className="mb-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {phaseType === 'ELIMINATION_SIMPLE' || phaseType === 'CONSOLANTE'
                    ? 'Phase finale'
                    : 'Phase de compétition'}
                </p>
                <h3 className="text-base font-semibold tracking-tight text-foreground">
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
                terrains={concours.terrains}
                readOnly={readOnly}
              />
            ) : /* Rendu spécialisé Championnat (poules round-robin) */
            phaseType === 'CHAMPIONNAT' && phaseData ? (
              <PoolsPhaseView
                matchs={phaseData.matchs}
                equipeLookup={equipeLookup}
                concoursId={concours.id}
                mode="roundrobin"
                terrains={concours.terrains}
                readOnly={readOnly}
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
                readOnly={readOnly}
              />
            ) : (
              /* Fallback : rendu tableau classique */
              <TablePhaseView
                tours={tours}
                equipeLookup={equipeLookup}
                concoursId={concours.id}
                terrains={concours.terrains}
                readOnly={readOnly}
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
  terrains = [],
  readOnly,
}: {
  matchs: MatchDto[];
  equipeLookup: Map<string, string>;
  concoursId: string;
  mode: 'gsl' | 'roundrobin';
  terrains?: TerrainDto[];
  readOnly?: boolean;
}) {
  const pools = useMemo(() => reconstructPools(matchs), [matchs]);

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {pools.map((pool, idx) => (
        <PoolGroupCard
          key={idx}
          pouleIndex={idx}
          equipeIds={pool.equipeIds}
          matchs={pool.matchs}
          equipeLookup={equipeLookup}
          concoursId={concoursId}
          mode={mode}
          terrains={terrains}
          readOnly={readOnly}
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
  readOnly,
}: {
  tours: { tourNum: number; nom?: string; matchs: MatchDto[] }[];
  equipeLookup: Map<string, string>;
  concoursId: string;
  terrains?: TerrainDto[];
  readOnly?: boolean;
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
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Équipe A</TableHead>
                  <TableHead className="text-center w-12" />
                  <TableHead>Équipe B</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead>Terrain</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matchs.map((m) => (
                  <MatchRow
                    key={m.id}
                    match={m}
                    concoursId={concoursId}
                    equipeANom={equipeLookup.get(m.equipeAId) ?? m.equipeAId}
                    equipeBNom={m.equipeBId ? (equipeLookup.get(m.equipeBId) ?? m.equipeBId) : 'Exempt'}
                    terrains={terrains}
                    readOnly={readOnly}
                  />
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
