import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { fetchMatchs } from '@/api/matchs';
import { exportResumePdf, type ResumeSeg, type ResumeTeam } from '@/lib/pdf-export';
import type { ConcoursDetail, MatchDto } from '@/types/concours';


// ─── Calcul du résumé ────────────────────────────────────────────────────────

function computeResume(
  allMatchs: MatchDto[],
  equipeLookup: Map<string, string>,
  phases: ConcoursDetail['phases'],
): { segments: ResumeSeg[]; teams: ResumeTeam[] } {
  const segments: ResumeSeg[] = [];
  // equipeId → segmentKey → victoires (undefined = non participant)
  const teamSegWins = new Map<string, Record<string, number | undefined>>();

  for (const [id] of equipeLookup) {
    teamSegWins.set(id, {});
  }

  // Grouper matchs par phaseId
  const matchsByPhaseId = new Map<
    string,
    { phaseType: string; phaseNom?: string; matchs: MatchDto[] }
  >();
  for (const m of allMatchs) {
    const key = m.phaseId ?? 'default';
    if (!matchsByPhaseId.has(key)) {
      matchsByPhaseId.set(key, {
        phaseType: m.phaseType ?? '',
        phaseNom: m.phaseNom,
        matchs: [],
      });
    }
    matchsByPhaseId.get(key)!.matchs.push(m);
  }

  // Ordonner selon l'ordre des phases du concours
  const phaseOrder = new Map<string, number>();
  phases.forEach((p, i) => phaseOrder.set(p.id, i));
  const orderedPhases = Array.from(matchsByPhaseId.entries()).sort(
    ([a], [b]) => (phaseOrder.get(a) ?? 99) - (phaseOrder.get(b) ?? 99),
  );

  // Clés fixes pour merger les phases du même type
  const SEG_POULES = 'phase_poules';
  const SEG_CONSOLANTE = 'phase_consolante';

  for (const [phaseId, { phaseType, phaseNom, matchs: phaseMatchs }] of orderedPhases) {
    if (phaseType === 'POULES' || phaseType === 'CHAMPIONNAT') {
      // Un seul segment global "Phase de poules" (toutes poules confondues)
      if (!segments.find((s) => s.key === SEG_POULES)) {
        segments.push({ key: SEG_POULES, label: 'Phase de poules' });
      }
      for (const m of phaseMatchs) {
        for (const id of [m.equipeAId, m.equipeBId]) {
          if (!teamSegWins.has(id)) teamSegWins.set(id, {});
          if (teamSegWins.get(id)![SEG_POULES] === undefined) {
            teamSegWins.get(id)![SEG_POULES] = 0;
          }
        }
        if ((m.statut !== 'TERMINE' && m.statut !== 'FORFAIT') || !m.score) continue;
        if (m.score.equipeA > m.score.equipeB) {
          teamSegWins.get(m.equipeAId)![SEG_POULES] =
            (teamSegWins.get(m.equipeAId)![SEG_POULES] ?? 0) + 1;
        } else if (m.score.equipeB > m.score.equipeA) {
          teamSegWins.get(m.equipeBId)![SEG_POULES] =
            (teamSegWins.get(m.equipeBId)![SEG_POULES] ?? 0) + 1;
        }
      }
    } else if (phaseType === 'CONSOLANTE') {
      // Un seul segment global "Consolante" (toutes consolantes confondues)
      if (!segments.find((s) => s.key === SEG_CONSOLANTE)) {
        segments.push({ key: SEG_CONSOLANTE, label: 'Consolante' });
      }
      for (const m of phaseMatchs) {
        for (const id of [m.equipeAId, m.equipeBId]) {
          if (!teamSegWins.has(id)) teamSegWins.set(id, {});
          if (teamSegWins.get(id)![SEG_CONSOLANTE] === undefined) {
            teamSegWins.get(id)![SEG_CONSOLANTE] = 0;
          }
        }
        if ((m.statut !== 'TERMINE' && m.statut !== 'FORFAIT') || !m.score) continue;
        if (m.score.equipeA > m.score.equipeB) {
          teamSegWins.get(m.equipeAId)![SEG_CONSOLANTE] =
            (teamSegWins.get(m.equipeAId)![SEG_CONSOLANTE] ?? 0) + 1;
        } else if (m.score.equipeB > m.score.equipeA) {
          teamSegWins.get(m.equipeBId)![SEG_CONSOLANTE] =
            (teamSegWins.get(m.equipeBId)![SEG_CONSOLANTE] ?? 0) + 1;
        }
      }
    } else if (phaseType === 'ELIMINATION_SIMPLE' || phaseType === 'SYSTEME_SUISSE') {
      // Un segment par phase (avec son nom : "Championnat A", "Championnat B"…)
      const segKey = phaseId;
      const label = phaseNom ?? (phaseType === 'SYSTEME_SUISSE' ? 'Système Suisse' : 'Phase finale');
      segments.push({ key: segKey, label });

      for (const m of phaseMatchs) {
        for (const id of [m.equipeAId, m.equipeBId]) {
          if (!teamSegWins.has(id)) teamSegWins.set(id, {});
          if (teamSegWins.get(id)![segKey] === undefined) {
            teamSegWins.get(id)![segKey] = 0;
          }
        }
        if ((m.statut !== 'TERMINE' && m.statut !== 'FORFAIT') || !m.score) continue;
        if (m.score.equipeA > m.score.equipeB) {
          teamSegWins.get(m.equipeAId)![segKey] =
            (teamSegWins.get(m.equipeAId)![segKey] ?? 0) + 1;
        } else if (m.score.equipeB > m.score.equipeA) {
          teamSegWins.get(m.equipeBId)![segKey] =
            (teamSegWins.get(m.equipeBId)![segKey] ?? 0) + 1;
        }
      }
    }
  }

  // Construire les lignes de tableau
  const teams: ResumeTeam[] = Array.from(equipeLookup.entries()).map(([equipeId, nom]) => {
    const segs = teamSegWins.get(equipeId) ?? {};
    const totalVictoires = Object.values(segs).reduce<number>(
      (acc, v) => acc + (v ?? 0),
      0,
    );
    return { equipeId, nom, totalVictoires, segments: segs };
  });

  // Tri : total victoires desc, puis nom asc
  teams.sort((a, b) => {
    if (b.totalVictoires !== a.totalVictoires) return b.totalVictoires - a.totalVictoires;
    return a.nom.localeCompare(b.nom);
  });

  return { segments, teams };
}

// ─── Couleurs podium ─────────────────────────────────────────────────────────

function getRankStyle(idx: number) {
  if (idx === 0) return { row: 'bg-amber-50/60 dark:bg-amber-900/15', badge: 'bg-amber-400 text-white' };
  if (idx === 1) return { row: 'bg-slate-50/60 dark:bg-slate-800/20', badge: 'bg-slate-400 text-white' };
  if (idx === 2) return { row: 'bg-orange-50/60 dark:bg-orange-900/10', badge: 'bg-orange-400 text-white' };
  return { row: '', badge: 'bg-muted text-muted-foreground' };
}

// ─── Composant ───────────────────────────────────────────────────────────────

interface ResumeTabProps {
  concours: ConcoursDetail;
}

export function ResumeTab({ concours }: ResumeTabProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['concours', concours.id, 'matchs'],
    queryFn: () => fetchMatchs(concours.id),
    enabled:
      concours.statut === 'EN_COURS' ||
      concours.statut === 'TERMINE' ||
      concours.statut === 'ARCHIVE',
  });

  const equipeLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const insc of concours.inscriptions) {
      map.set(insc.equipeId, insc.nomEquipe);
    }
    return map;
  }, [concours.inscriptions]);

  const { segments, teams } = useMemo(() => {
    const allMatchs = data?.data ?? [];
    if (allMatchs.length === 0) return { segments: [], teams: [] };
    return computeResume(allMatchs, equipeLookup, concours.phases);
  }, [data, equipeLookup, concours.phases]);

  if (isLoading) {
    return <p className="py-8 text-center text-muted-foreground">Chargement...</p>;
  }

  if (teams.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        Aucune donnée disponible — le tournoi n'a pas encore commencé.
      </p>
    );
  }

  const nbMatchsJoues = (data?.data ?? []).filter(
    (m) => m.statut === 'TERMINE' || m.statut === 'FORFAIT',
  ).length;

  return (
    <div className="space-y-4">
      {/* Barre d'outils */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Trophy className="h-4 w-4 text-primary" />
          <span>
            {teams.length} équipes ·{' '}
            {segments.length} phase{segments.length > 1 ? 's' : ''} ·{' '}
            {nbMatchsJoues} match{nbMatchsJoues > 1 ? 's' : ''} joué{nbMatchsJoues > 1 ? 's' : ''}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportResumePdf(concours, teams, segments)}
        >
          <FileText className="mr-2 h-4 w-4" />
          Exporter PDF
        </Button>
      </div>

      {/* Tableau principal */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Récapitulatif des victoires</CardTitle>
          <p className="text-sm text-muted-foreground">
            Comptabilisation fédérale — victoires détaillées par phase et par poule
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead className="min-w-[140px]">Équipe</TableHead>
                  <TableHead className="w-20 text-center font-bold">Total V</TableHead>
                  {segments.map((seg) => (
                    <TableHead key={seg.key} className="w-24 text-center text-xs whitespace-nowrap">
                      {seg.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((team, idx) => {
                  const { row, badge } = getRankStyle(idx);
                  return (
                    <TableRow key={team.equipeId} className={cn('transition-colors', row)}>
                      {/* Rang */}
                      <TableCell className="text-center py-2.5">
                        <span
                          className={cn(
                            'flex h-6 w-6 mx-auto items-center justify-center rounded text-xs font-bold',
                            badge,
                          )}
                        >
                          {idx + 1}
                        </span>
                      </TableCell>

                      {/* Nom de l'équipe */}
                      <TableCell className="font-medium py-2.5">{team.nom}</TableCell>

                      {/* Total victoires */}
                      <TableCell className="text-center py-2.5">
                        <Badge
                          variant={team.totalVictoires > 0 ? 'default' : 'secondary'}
                          className="tabular-nums min-w-[2rem] justify-center"
                        >
                          {team.totalVictoires}
                        </Badge>
                      </TableCell>

                      {/* Victoires par segment */}
                      {segments.map((seg) => {
                        const v = team.segments[seg.key];
                        return (
                          <TableCell
                            key={seg.key}
                            className="text-center tabular-nums text-sm py-2.5"
                          >
                            {v === undefined ? (
                              <span className="text-muted-foreground/30 text-xs">—</span>
                            ) : v > 0 ? (
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {v}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">0</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Légende */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground px-1">
        <span>
          <strong>Total V</strong> = total des victoires toutes phases confondues
        </span>
        <span>
          <span className="text-muted-foreground/30">—</span> = non participant à cette phase
        </span>
        <span>
          <span className="font-semibold text-emerald-600">n</span> = victoire(s) dans ce segment
        </span>
      </div>
    </div>
  );
}
