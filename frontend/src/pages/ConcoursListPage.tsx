import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trophy, UsersRound } from 'lucide-react';
import { fetchConcours, createConcours, ouvrirInscriptions, archiverConcours, supprimerConcours, modifierVisibiliteConcours } from '@/api/concours';
import { ConcoursTable } from '@/components/concours/ConcoursTable';
import { ArchivesTab } from '@/components/concours/ArchivesTab';
import { CreateConcoursDialog } from '@/components/concours/CreateConcoursDialog';
import { ImportConcoursDialog } from '@/components/concours/ImportConcoursDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/auth/AuthContext';
import type { CreateConcoursPayload } from '@/types/concours';
import { ActionError } from '@/components/ui/action-error';
import { ClubPlayersPanel } from '@/components/club/ClubPlayersPanel';

interface ConcoursListPageProps {
  onSelectConcours: (id: string) => void;
}

export function ConcoursListPage({ onSelectConcours }: ConcoursListPageProps) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['concours'],
    queryFn: fetchConcours,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateConcoursPayload) => createConcours(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['concours'] }),
  });

  const ouvrirMutation = useMutation({
    mutationFn: (id: string) => ouvrirInscriptions(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['concours'] }),
  });

  const archiverMutation = useMutation({
    mutationFn: (id: string) => archiverConcours(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['concours'] }),
  });

  const supprimerMutation = useMutation({
    mutationFn: (id: string) => supprimerConcours(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['concours'] }),
  });

  const visibiliteMutation = useMutation({
    mutationFn: ({ id, estPublic }: { id: string; estPublic: boolean }) => modifierVisibiliteConcours(id, estPublic),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['concours'] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        Erreur : {error instanceof Error ? error.message : 'Erreur inconnue'}
      </div>
    );
  }

  const tous = data?.data ?? [];
  const actifs = tous.filter((c) => c.statut !== 'ARCHIVE');
  const archives = tous.filter((c) => c.statut === 'ARCHIVE');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Concours</h2>
            <p className="text-xs text-muted-foreground">
              {actifs.length} actif{actifs.length > 1 ? 's' : ''}
              {archives.length > 0 && ` · ${archives.length} archivé${archives.length > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        {isAuthenticated && (
          <div className="flex w-full flex-wrap gap-2 [&>button]:flex-1 sm:w-auto sm:justify-end sm:[&>button]:flex-none">
            <ImportConcoursDialog />
            <CreateConcoursDialog
              onSubmit={(payload) => createMutation.mutateAsync(payload)}
              isPending={createMutation.isPending}
            />
          </div>
        )}
      </div>

      <ActionError
        error={ouvrirMutation.error ?? archiverMutation.error ?? supprimerMutation.error ?? visibiliteMutation.error}
      />

      {/* Tabs */}
      <Tabs defaultValue="actifs">
        <TabsList className="h-11 min-h-11 sm:h-9 sm:min-h-0">
          <TabsTrigger value="actifs" className="min-h-10 text-sm sm:min-h-0">
            Actifs
            {actifs.length > 0 && (
              <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-px text-[10px] font-semibold text-primary">
                {actifs.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="archives" className="min-h-10 text-sm sm:min-h-0">
            Archives
            {archives.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted-foreground/15 px-1.5 py-px text-[10px] font-semibold text-muted-foreground">
                {archives.length}
              </span>
            )}
          </TabsTrigger>
          {isAuthenticated && (
            <TabsTrigger value="joueurs" className="min-h-10 gap-1.5 text-sm sm:min-h-0">
              <UsersRound className="h-3.5 w-3.5" />Joueurs du club
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="actifs" className="mt-4">
          <ConcoursTable
            concours={actifs}
            onOuvrirInscriptions={isAuthenticated ? (id) => ouvrirMutation.mutate(id) : undefined}
            onSelectConcours={onSelectConcours}
            onArchiver={isAuthenticated ? (id) => archiverMutation.mutate(id) : undefined}
            onSupprimer={isAuthenticated ? (id) => supprimerMutation.mutate(id) : undefined}
            onModifierVisibilite={isAuthenticated ? (id, estPublic) => visibiliteMutation.mutate({ id, estPublic }) : undefined}
            visibilityUpdatingId={visibiliteMutation.isPending ? visibiliteMutation.variables?.id : undefined}
          />
        </TabsContent>

        <TabsContent value="archives" className="mt-4">
          <ArchivesTab
            archives={archives}
            onSupprimer={isAuthenticated ? (id) => supprimerMutation.mutate(id) : undefined}
            onSelectConcours={onSelectConcours}
            onModifierVisibilite={isAuthenticated ? (id, estPublic) => visibiliteMutation.mutate({ id, estPublic }) : undefined}
            visibilityUpdatingId={visibiliteMutation.isPending ? visibiliteMutation.variables?.id : undefined}
          />
        </TabsContent>

        {isAuthenticated && (
          <TabsContent value="joueurs" className="mt-4">
            <ClubPlayersPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
