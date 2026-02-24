import type { ReactNode } from 'react';

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground shadow-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <img
            src="/ibm-logo-blanc.png"
            alt="IBM"
            className="h-10 w-10 object-contain"
          />
          <div>
            <h1 className="text-lg font-bold tracking-wide">
              ccOrgaTournoi
            </h1>
            <p className="text-xs text-primary-foreground/70">
              Indépendante Boule Magnet
            </p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
