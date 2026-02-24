import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchConcoursDetail } from '@/api/concours';
import { ConcoursInfoCard } from './ConcoursInfoCard';
import { InscriptionsTab } from './InscriptionsTab';
import { TerrainsTab } from './TerrainsTab';
import { MatchsTab } from './MatchsTab';
import { ClassementTab } from './ClassementTab';
import type { StatutConcours } from '@/types/concours';

function getDefaultTab(statut: StatutConcours): string {
  if (statut === 'EN_COURS') return 'matchs';
  if (statut === 'TERMINE' || statut === 'ARCHIVE') return 'classement';
  return 'inscriptions';
}

interface ConcoursDetailPageProps {
  concoursId: string;
  onBack: () => void;
}

export function ConcoursDetailPage({ concoursId, onBack }: ConcoursDetailPageProps) {
  const { data: concours, isLoading, error } = useQuery({
    queryKey: ['concours', concoursId],
    queryFn: () => fetchConcoursDetail(concoursId),
  });

  if (isLoading) {
    return <p className="py-8 text-center text-muted-foreground">Chargement...</p>;
  }

  if (error || !concours) {
    return (
      <div className="space-y-4 py-8 text-center">
        <p className="text-destructive">
          Erreur : {error instanceof Error ? error.message : 'Concours introuvable'}
        </p>
        <Button variant="outline" onClick={onBack}>
          Retour à la liste
        </Button>
      </div>
    );
  }

  const hasPhases = concours.phases.length > 0;
  const matchsEnabled = concours.statut === 'EN_COURS' || concours.statut === 'TERMINE';

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" onClick={onBack}>
        ← Retour à la liste
      </Button>

      <ConcoursInfoCard concours={concours} />

      <Tabs defaultValue={getDefaultTab(concours.statut)}>
        <TabsList>
          <TabsTrigger value="inscriptions">Inscriptions</TabsTrigger>
          <TabsTrigger value="terrains">Terrains</TabsTrigger>
          <TabsTrigger value="matchs" disabled={!matchsEnabled}>
            Matchs
          </TabsTrigger>
          <TabsTrigger value="classement" disabled={!hasPhases}>
            Classement
          </TabsTrigger>
        </TabsList>
        <TabsContent value="inscriptions">
          <InscriptionsTab concours={concours} />
        </TabsContent>
        <TabsContent value="terrains">
          <TerrainsTab concours={concours} />
        </TabsContent>
        <TabsContent value="matchs">
          <MatchsTab concours={concours} />
        </TabsContent>
        <TabsContent value="classement">
          <ClassementTab concours={concours} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
