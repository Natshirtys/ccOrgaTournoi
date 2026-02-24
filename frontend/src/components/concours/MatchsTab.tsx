import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MatchRow } from './MatchRow';
import { fetchMatchs } from '@/api/matchs';
import type { ConcoursDetail, MatchDto } from '@/types/concours';

interface MatchsTabProps {
  concours: ConcoursDetail;
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

  const matchsByTour = useMemo(() => {
    const matchs = data?.data ?? [];
    const grouped = new Map<number, MatchDto[]>();
    for (const m of matchs) {
      const tour = m.tourNumero;
      if (!grouped.has(tour)) grouped.set(tour, []);
      grouped.get(tour)!.push(m);
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => a - b);
  }, [data]);

  if (isLoading) {
    return <p className="py-8 text-center text-muted-foreground">Chargement des matchs...</p>;
  }

  if (matchsByTour.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">Aucun match.</p>;
  }

  return (
    <div className="space-y-4">
      {matchsByTour.map(([tour, matchs]) => (
        <Card key={tour}>
          <CardHeader>
            <CardTitle className="text-lg">Tour {tour}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Équipe A</TableHead>
                  <TableHead className="text-center w-12" />
                  <TableHead>Équipe B</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matchs.map((m) => (
                  <MatchRow
                    key={m.id}
                    match={m}
                    concoursId={concours.id}
                    equipeANom={equipeLookup.get(m.equipeAId) ?? m.equipeAId}
                    equipeBNom={equipeLookup.get(m.equipeBId) ?? m.equipeBId}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
