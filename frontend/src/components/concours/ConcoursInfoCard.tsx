import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConcoursStatusBadge } from './ConcoursStatusBadge';
import {
  ouvrirInscriptions,
  cloturerInscriptions,
  lancerTirage,
  annulerConcours,
} from '@/api/concours';
import type { ConcoursDetail } from '@/types/concours';

const TYPE_LABELS: Record<string, string> = {
  TETE_A_TETE: 'Tête-à-tête',
  DOUBLETTE: 'Doublette',
  TRIPLETTE: 'Triplette',
  QUADRETTE: 'Quadrette',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR');
}

interface ConcoursInfoCardProps {
  concours: ConcoursDetail;
}

export function ConcoursInfoCard({ concours }: ConcoursInfoCardProps) {
  const queryClient = useQueryClient();
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['concours'] });
    queryClient.invalidateQueries({ queryKey: ['concours', concours.id] });
  };

  const ouvrirMutation = useMutation({
    mutationFn: () => ouvrirInscriptions(concours.id),
    onSuccess: invalidateAll,
  });

  const cloturerMutation = useMutation({
    mutationFn: () => cloturerInscriptions(concours.id),
    onSuccess: invalidateAll,
  });

  const tirageMutation = useMutation({
    mutationFn: () => lancerTirage(concours.id, { typePhase: 'POULES' }),
    onSuccess: invalidateAll,
  });

  const annulerMutation = useMutation({
    mutationFn: () => annulerConcours(concours.id),
    onSuccess: invalidateAll,
  });

  const statut = concours.statut;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">{concours.nom}</CardTitle>
          <ConcoursStatusBadge statut={statut} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Lieu</p>
            <p className="font-medium">{concours.lieu}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Dates</p>
            <p className="font-medium">
              {formatDate(concours.dates.debut)} — {formatDate(concours.dates.fin)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Type</p>
            <p className="font-medium">
              {TYPE_LABELS[concours.formule.typeEquipe] ?? concours.formule.typeEquipe}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Équipes / Terrains</p>
            <p className="font-medium">
              {concours.nbEquipesInscrites} équipes · {concours.nbTerrains} terrains
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          {statut === 'BROUILLON' && (
            <Button
              size="sm"
              onClick={() => ouvrirMutation.mutate()}
              disabled={ouvrirMutation.isPending}
            >
              Ouvrir inscriptions
            </Button>
          )}
          {statut === 'INSCRIPTIONS_OUVERTES' && (
            <Button
              size="sm"
              onClick={() => cloturerMutation.mutate()}
              disabled={cloturerMutation.isPending}
            >
              Clôturer inscriptions
            </Button>
          )}
          {statut === 'INSCRIPTIONS_CLOSES' && (
            <Button
              size="sm"
              onClick={() => tirageMutation.mutate()}
              disabled={tirageMutation.isPending}
            >
              Lancer tirage
            </Button>
          )}
          {statut !== 'ANNULE' && statut !== 'TERMINE' && statut !== 'ARCHIVE' && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => annulerMutation.mutate()}
              disabled={annulerMutation.isPending}
            >
              Annuler
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
