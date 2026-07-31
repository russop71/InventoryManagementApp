const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

function buildUrl(path: string) {
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      // keep fallback
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}
