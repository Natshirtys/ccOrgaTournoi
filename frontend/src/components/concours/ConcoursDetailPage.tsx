import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchConcoursDetail } from '@/api/concours';
import { ConcoursInfoCard } from './ConcoursInfoCard';
import { InscriptionsTab } from './InscriptionsTab';
import { TerrainsTab } from './TerrainsTab';
import { MatchsTab } from './MatchsTab';
import { ClassementTab } from './ClassementTab';
import { ResumeTab } from './ResumeTab';
import { useAuth } from '@/auth/AuthContext';
import type { ConcoursDetail, StatutConcours } from '@/types/concours';

function getDefaultTab(statut: StatutConcours, hasClassement: boolean): string {
  if (statut === 'EN_COURS') return 'matchs';
  if (statut === 'TERMINE' || statut === 'ARCHIVE') return hasClassement ? 'classement' : 'matchs';
  return 'inscriptions';
}

interface ConcoursDetailPageProps {
  concoursId: string;
  onBack: () => void;
}

interface ConcoursDetailContentProps {
  concours: ConcoursDetail;
  isAuthenticated: boolean;
  onBack: () => void;
}

function ConcoursDetailContent({
  concours,
  isAuthenticated,
  onBack,
}: ConcoursDetailContentProps) {
  const hasPhases = concours.phases.length > 0;
  const hasClassement = concours.phases.some((p) => ['SYSTEME_SUISSE', 'MELEE', 'MELEE_TOURNANTE'].includes(p.type));
  const isMelee = concours.formule.typePhase === 'MELEE' || concours.formule.typePhase === 'MELEE_TOURNANTE';
  const matchsEnabled = concours.statut === 'EN_COURS'
    || concours.statut === 'TERMINE'
    || concours.statut === 'ARCHIVE';
  const readOnly = !isAuthenticated || concours.statut === 'ARCHIVE';
  const [activeTab, setActiveTab] = useState(() =>
    getDefaultTab(concours.statut, hasClassement),
  );

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" className="h-10 sm:h-8" onClick={onBack}>
        ← Retour à la liste
      </Button>

      <ConcoursInfoCard concours={concours} onNavigateToTab={setActiveTab} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto overflow-y-hidden">
          <TabsList className="h-11 min-h-11 w-max sm:h-9 sm:min-h-0">
            <TabsTrigger value="inscriptions" className="min-h-10 sm:min-h-0">Inscriptions</TabsTrigger>
            <TabsTrigger value="terrains" className="min-h-10 sm:min-h-0">Terrains</TabsTrigger>
            <TabsTrigger value="matchs" className="min-h-10 sm:min-h-0" disabled={!matchsEnabled}>
              Matchs
            </TabsTrigger>
            {hasClassement && (
              <TabsTrigger value="classement" className="min-h-10 sm:min-h-0" disabled={!hasPhases}>
                Classement
              </TabsTrigger>
            )}
            {!isMelee && <TabsTrigger value="resume" className="min-h-10 sm:min-h-0" disabled={!matchsEnabled}>Résumé</TabsTrigger>}
          </TabsList>
        </div>
        <TabsContent value="inscriptions">
          <InscriptionsTab concours={concours} readOnly={readOnly} />
        </TabsContent>
        <TabsContent value="terrains">
          <TerrainsTab concours={concours} readOnly={readOnly} />
        </TabsContent>
        <TabsContent value="matchs">
          <MatchsTab
            concours={concours}
            readOnly={readOnly}
            onReturnToInscriptions={() => setActiveTab('inscriptions')}
          />
        </TabsContent>
        {hasClassement && (
          <TabsContent value="classement">
            <ClassementTab concours={concours} />
          </TabsContent>
        )}
        {!isMelee && <TabsContent value="resume"><ResumeTab concours={concours} /></TabsContent>}
      </Tabs>
    </div>
  );
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

  return (
    <ConcoursDetailContent
      concours={concours}
      isAuthenticated={isAuthenticated}
      onBack={onBack}
    />
  );
}
