import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { ConcoursListPage } from '@/pages/ConcoursListPage';
import { ConcoursDetailPage } from '@/components/concours/ConcoursDetailPage';
import { AuthProvider } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import {
  navigateToConcours,
  navigateToList,
  returnToList,
  useAppRoute,
} from '@/lib/navigation';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const route = useAppRoute();

  let content: React.ReactNode;
  if (route.page === 'concours') {
    content = (
      <ConcoursDetailPage
        concoursId={route.concoursId}
        onBack={returnToList}
      />
    );
  } else if (route.page === 'not-found') {
    content = (
      <div className="space-y-4 py-16 text-center">
        <h2 className="text-xl font-bold">Page introuvable</h2>
        <p className="text-sm text-muted-foreground">Cette adresse ne correspond à aucun écran de l’application.</p>
        <Button variant="outline" onClick={navigateToList}>Retour aux concours</Button>
      </div>
    );
  } else {
    content = <ConcoursListPage onSelectConcours={navigateToConcours} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppLayout>
          {content}
        </AppLayout>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
