import { useState, useEffect, type ReactNode } from 'react';
import { ModeToggle } from '@/components/mode-toggle';
import { LoginDialog } from '@/components/auth/LoginDialog';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, Mail } from 'lucide-react';

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
      <header className="relative overflow-hidden border-b border-white/10 bg-[#071a2e] text-white shadow-[0_10px_30px_rgba(2,12,27,0.22)]">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#3ba6f2] via-[#77c8ff] to-[#3ba6f2]" />
        <div aria-hidden="true" className="absolute -right-24 -top-24 size-64 rounded-full bg-[#3ba6f2]/10 blur-3xl" />

        <div className="relative flex min-h-[76px] items-center gap-2 px-3 py-2 sm:min-h-[84px] sm:gap-4 sm:px-6 lg:px-8">
          <div className="grid size-14 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] sm:size-16">
            <img
              src="/ibm-logo-blanc.png"
              alt="Logo Indépendante Boule Magnet"
              className="h-12 w-12 object-contain sm:h-14 sm:w-14"
            />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold tracking-[-0.02em] sm:text-xl">
              <span className="sm:hidden">Boule Magnet</span>
              <span className="hidden sm:inline">Indépendante Boule Magnet</span>
            </h1>
            <p className="mt-0.5 text-[11px] font-medium tracking-[0.12em] text-white/60 uppercase sm:text-xs">
              Gestion des concours
            </p>
          </div>

          {isAuthenticated ? (
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <span className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-white/70 xl:flex">
                <Mail className="size-3.5 text-[#77c8ff]" />
                {user?.email}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                aria-label="Déconnexion"
                className="h-10 border border-white/15 bg-white/[0.08] px-3 text-white shadow-sm hover:bg-white/15 hover:text-white"
              >
                <LogOut className="size-4" />
                <span className="hidden md:inline">Déconnexion</span>
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLoginOpen(true)}
              className="h-10 border border-white/15 bg-white/[0.08] px-3 text-white shadow-sm hover:bg-white/15 hover:text-white"
            >
              <LogIn className="size-4" />
              <span className="hidden sm:inline">Connexion admin</span>
              <span className="hidden min-[360px]:inline sm:hidden">Admin</span>
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
