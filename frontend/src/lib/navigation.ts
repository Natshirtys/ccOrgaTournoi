import { useSyncExternalStore } from 'react';

const NAVIGATION_EVENT = 'cc-orga:navigation';

export type AppRoute =
  | { page: 'list' }
  | { page: 'concours'; concoursId: string }
  | { page: 'not-found' };

export function concoursPath(concoursId: string): string {
  return `/concours/${encodeURIComponent(concoursId)}`;
}

export function parseRoute(pathname: string): AppRoute {
  if (pathname === '/' || pathname === '') return { page: 'list' };

  const match = pathname.match(/^\/concours\/([^/]+)\/?$/);
  if (!match) return { page: 'not-found' };

  try {
    return { page: 'concours', concoursId: decodeURIComponent(match[1]) };
  } catch {
    return { page: 'not-found' };
  }
}

function getPathname(): string {
  return window.location.pathname;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('popstate', callback);
  window.addEventListener(NAVIGATION_EVENT, callback);
  return () => {
    window.removeEventListener('popstate', callback);
    window.removeEventListener(NAVIGATION_EVENT, callback);
  };
}

function navigate(path: string, state: Record<string, boolean> = {}): void {
  if (window.location.pathname === path) return;
  window.history.pushState(state, '', path);
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
  window.scrollTo({ top: 0, behavior: 'instant' });
}

export function navigateToConcours(concoursId: string): void {
  navigate(concoursPath(concoursId), {
    fromConcoursList: window.location.pathname === '/',
  });
}

export function navigateToList(): void {
  navigate('/');
}

export function returnToList(): void {
  const state = window.history.state as { fromConcoursList?: boolean } | null;
  if (state?.fromConcoursList) {
    window.history.back();
    return;
  }
  navigateToList();
}

export function useAppRoute(): AppRoute {
  const pathname = useSyncExternalStore(subscribe, getPathname, () => '/');
  return parseRoute(pathname);
}
