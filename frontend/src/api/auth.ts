import { apiFetch, BASE_URL } from './client';

export const TOKEN_KEY = 'cc-orga-token';

export interface AuthUser {
  email: string;
  role: 'admin';
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiLogin(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Identifiants incorrects');
  }

  const data = await res.json() as { token?: string };
  if (typeof data.token !== 'string') {
    throw new Error('Réponse serveur invalide');
  }
  return data.token;
}

export async function apiMe(signal?: AbortSignal): Promise<AuthUser> {
  return apiFetch<{ user: AuthUser }>('/auth/me', { signal }).then((r) => r.user);
}
