import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { fetchConcours, createConcours, ouvrirInscriptions, archiverConcours, supprimerConcours } from '@/api/concours';
import { ConcoursTable } from '@/components/concours/ConcoursTable';
import { ArchivesTab } from '@/components/concours/ArchivesTab';
import { CreateConcoursDialog } from '@/components/concours/CreateConcoursDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CreateConcoursPayload } from '@/types/concours';

interface ConcoursListPageProps {
  onSelectConcours: (id: string) => void;
}

export function ConcoursListPage({ onSelectConcours }: ConcoursListPageProps) {
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
      <div className="flex items-start justify-between gap-4">
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
        <CreateConcoursDialog
          onSubmit={(payload) => createMutation.mutate(payload)}
          isPending={createMutation.isPending}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="actifs">
        <TabsList className="h-9">
          <TabsTrigger value="actifs" className="text-sm">
            Actifs
            {actifs.length > 0 && (
              <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-px text-[10px] font-semibold text-primary">
                {actifs.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="archives" className="text-sm">
            Archives
            {archives.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted-foreground/15 px-1.5 py-px text-[10px] font-semibold text-muted-foreground">
                {archives.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="actifs" className="mt-4">
          <ConcoursTable
            concours={actifs}
            onOuvrirInscriptions={(id) => ouvrirMutation.mutate(id)}
            onSelectConcours={onSelectConcours}
            onArchiver={(id) => archiverMutation.mutate(id)}
            onSupprimer={(id) => supprimerMutation.mutate(id)}
          />
        </TabsContent>

        <TabsContent value="archives" className="mt-4">
          <ArchivesTab
            archives={archives}
            onSupprimer={(id) => supprimerMutation.mutate(id)}
            onSelectConcours={onSelectConcours}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
