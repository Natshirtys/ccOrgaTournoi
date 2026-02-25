import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fetchClassement } from '@/api/matchs';
import { exportClassement } from '@/lib/pdf-export';
import type { ConcoursDetail } from '@/types/concours';

interface ClassementTabProps {
  concours: ConcoursDetail;
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

  const classement = data?.data ?? [];

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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Rang</TableHead>
          <TableHead>Équipe</TableHead>
          <TableHead className="text-center">Pts</TableHead>
          <TableHead className="text-center">V</TableHead>
          <TableHead className="text-center">N</TableHead>
          <TableHead className="text-center">D</TableHead>
          <TableHead className="text-center">PM</TableHead>
          <TableHead className="text-center">PE</TableHead>
          <TableHead className="text-center">GA</TableHead>
          <TableHead className="text-center">Qualifiée</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {classement.map((ligne) => (
          <TableRow key={ligne.equipeId}>
            <TableCell className="font-medium">{ligne.rang}</TableCell>
            <TableCell className="font-medium">
              {equipeLookup.get(ligne.equipeId) ?? ligne.equipeId}
            </TableCell>
            <TableCell className="text-center">{ligne.points}</TableCell>
            <TableCell className="text-center">{ligne.victoires}</TableCell>
            <TableCell className="text-center">{ligne.nuls}</TableCell>
            <TableCell className="text-center">{ligne.defaites}</TableCell>
            <TableCell className="text-center">{ligne.pointsMarques}</TableCell>
            <TableCell className="text-center">{ligne.pointsEncaisses}</TableCell>
            <TableCell className="text-center">{ligne.goalAverage}</TableCell>
            <TableCell className="text-center">
              {ligne.qualifiee && <Badge variant="default">Qualifiée</Badge>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  );
}
