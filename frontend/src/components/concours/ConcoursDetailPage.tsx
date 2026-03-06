import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchConcoursDetail } from '@/api/concours';
import { ConcoursInfoCard } from './ConcoursInfoCard';
import { InscriptionsTab } from './InscriptionsTab';
import { TerrainsTab } from './TerrainsTab';
import { MatchsTab } from './MatchsTab';
import { ClassementTab } from './ClassementTab';
import { useAuth } from '@/auth/AuthContext';
import type { StatutConcours } from '@/types/concours';

function getDefaultTab(statut: StatutConcours, hasSystemeSuisse: boolean): string {
  if (statut === 'EN_COURS') return 'matchs';
  if (statut === 'TERMINE' || statut === 'ARCHIVE') return hasSystemeSuisse ? 'classement' : 'matchs';
  return 'inscriptions';
}

interface ConcoursDetailPageProps {
  concoursId: string;
  onBack: () => void;
}

export function ConcoursDetailPage({ concoursId, onBack }: ConcoursDetailPageProps) {
  const { isAuthenticated } = useAuth();
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
  const hasSystemeSuisse = concours.phases.some((p) => p.type === 'SYSTEME_SUISSE');
  const matchsEnabled = concours.statut === 'EN_COURS' || concours.statut === 'TERMINE' || concours.statut === 'ARCHIVE';
  const readOnly = !isAuthenticated || concours.statut === 'ARCHIVE';

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" onClick={onBack}>
        ← Retour à la liste
      </Button>

      <ConcoursInfoCard concours={concours} />

      <Tabs defaultValue={getDefaultTab(concours.statut, hasSystemeSuisse)}>
        <TabsList>
          <TabsTrigger value="inscriptions">Inscriptions</TabsTrigger>
          <TabsTrigger value="terrains">Terrains</TabsTrigger>
          <TabsTrigger value="matchs" disabled={!matchsEnabled}>
            Matchs
          </TabsTrigger>
          {hasSystemeSuisse && (
            <TabsTrigger value="classement" disabled={!hasPhases}>
              Classement
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="inscriptions">
          <InscriptionsTab concours={concours} readOnly={readOnly} />
        </TabsContent>
        <TabsContent value="terrains">
          <TerrainsTab concours={concours} readOnly={readOnly} />
        </TabsContent>
        <TabsContent value="matchs">
          <MatchsTab concours={concours} readOnly={readOnly} />
        </TabsContent>
        {hasSystemeSuisse && (
          <TabsContent value="classement">
            <ClassementTab concours={concours} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
