export const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const { TOKEN_KEY } = await import('./auth');
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    // Délègue tout le cleanup à AuthContext via l'événement
    window.dispatchEvent(new CustomEvent('auth:expired'));
    const body = await res.json().catch(() => ({ message: 'Session expirée' }));
    throw new ApiError(res.status, body.message ?? body.error ?? 'Session expirée');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? body.error ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
