import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchConcours, createConcours, ouvrirInscriptions, annulerConcours } from '@/api/concours';
import { ConcoursTable } from '@/components/concours/ConcoursTable';
import { CreateConcoursDialog } from '@/components/concours/CreateConcoursDialog';
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

  const annulerMutation = useMutation({
    mutationFn: (id: string) => annulerConcours(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['concours'] }),
  });

  if (isLoading) {
    return <p className="py-8 text-center text-muted-foreground">Chargement...</p>;
  }

  if (error) {
    return (
      <p className="py-8 text-center text-destructive">
        Erreur : {error instanceof Error ? error.message : 'Erreur inconnue'}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Concours</h2>
        <CreateConcoursDialog
          onSubmit={(payload) => createMutation.mutate(payload)}
          isPending={createMutation.isPending}
        />
      </div>
      <ConcoursTable
        concours={data?.data ?? []}
        onOuvrirInscriptions={(id) => ouvrirMutation.mutate(id)}
        onAnnuler={(id) => annulerMutation.mutate(id)}
        onSelectConcours={onSelectConcours}
      />
    </div>
  );
}
