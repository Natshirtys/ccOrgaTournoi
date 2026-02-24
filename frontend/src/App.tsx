import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { ConcoursListPage } from '@/pages/ConcoursListPage';
import { ConcoursDetailPage } from '@/components/concours/ConcoursDetailPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const [selectedConcoursId, setSelectedConcoursId] = useState<string | null>(null);

  return (
    <QueryClientProvider client={queryClient}>
      <AppLayout>
        {selectedConcoursId ? (
          <ConcoursDetailPage
            concoursId={selectedConcoursId}
            onBack={() => setSelectedConcoursId(null)}
          />
        ) : (
          <ConcoursListPage onSelectConcours={setSelectedConcoursId} />
        )}
      </AppLayout>
    </QueryClientProvider>
  );
}

export default App;
