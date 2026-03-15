import { useState, useEffect, type ReactNode } from 'react';
import { ModeToggle } from '@/components/mode-toggle';
import { LoginDialog } from '@/components/auth/LoginDialog';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';

export function AppLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, user, logout } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Ouvrir automatiquement la dialog si la session expire
  useEffect(() => {
    const handler = () => {
      setSessionExpired(true);
      setLoginOpen(true);
    };
    window.addEventListener('auth:expired', handler);
    return () => window.removeEventListener('auth:expired', handler);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground shadow-md">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <img
            src="/ibm-logo-blanc.png"
            alt="IBM"
            className="h-10 w-10 object-contain"
          />
          <div className="flex-1">
            <h1 className="text-lg font-bold tracking-wide">
              ccOrgaTournoi
            </h1>
            <p className="text-xs text-primary-foreground/70">
              Indépendante Boule Magnet
            </p>
          </div>

          {isAuthenticated ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="hidden sm:inline text-xs text-primary-foreground/80">{user?.email}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={logout}
                aria-label="Déconnexion"
              >
                <span className="hidden sm:inline">Déconnexion</span>
                <span aria-hidden="true" className="sm:hidden">✕</span>
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setLoginOpen(true)}
            >
              <span className="hidden sm:inline">Connexion admin</span>
              <span className="sm:hidden">Admin</span>
            </Button>
          )}

          <ModeToggle />
        </div>
      </header>
      <main className="px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>

      <LoginDialog
        open={loginOpen}
        onOpenChange={(open) => { setLoginOpen(open); if (!open) setSessionExpired(false); }}
        sessionExpired={sessionExpired}
      />
    </div>
  );
}
