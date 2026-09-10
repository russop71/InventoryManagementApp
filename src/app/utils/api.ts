const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const AUTH_SESSION_KEY = 'zestiq:auth:session';
const PLATFORM_REAUTH_SESSION_KEY = 'zestiq:platform:reauth';

interface PlatformReauthSession {
  token: string;
  expiresAt: number;
}

export function readPlatformReauth(): PlatformReauthSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = JSON.parse(sessionStorage.getItem(PLATFORM_REAUTH_SESSION_KEY) || 'null') as PlatformReauthSession | null;
    if (!stored?.token || !Number.isFinite(stored.expiresAt) || stored.expiresAt <= Date.now()) {
      sessionStorage.removeItem(PLATFORM_REAUTH_SESSION_KEY);
      return null;
    }
    return stored;
  } catch {
    sessionStorage.removeItem(PLATFORM_REAUTH_SESSION_KEY);
    return null;
  }
}

export function storePlatformReauth(session: PlatformReauthSession) {
  sessionStorage.setItem(PLATFORM_REAUTH_SESSION_KEY, JSON.stringify(session));
}

export function clearPlatformReauth() {
  if (typeof window !== 'undefined') sessionStorage.removeItem(PLATFORM_REAUTH_SESSION_KEY);
}

interface StoredSession {
  token: string;
  accountId?: string;
  refreshToken?: string | null;
  expiresAt?: number | null;
  activeLocationId?: string;
}

function buildUrl(path: string) {
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}

function readSession(): StoredSession | null {
  const raw = localStorage.getItem(AUTH_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, init: RequestInit | undefined, allowRefresh: boolean): Promise<T> {
  const session = readSession();
  const platformReauth = path.startsWith('/api/v1/platform') ? readPlatformReauth() : null;
  const response = await fetch(buildUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(platformReauth?.token ? { 'X-ZestIQ-Platform-Reauth': platformReauth.token } : {}),
      ...(init?.headers || {}),
    },
  });

  if (response.status === 401 && allowRefresh && session?.refreshToken && path !== '/api/v1/auth/refresh') {
    const refreshResponse = await fetch(buildUrl('/api/v1/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    if (refreshResponse.ok) {
      const refreshed = await refreshResponse.json() as StoredSession;
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
        ...session,
        token: refreshed.token,
        refreshToken: refreshed.refreshToken || session.refreshToken,
        expiresAt: refreshed.expiresAt || session.expiresAt,
      }));
      return request<T>(path, init, false);
    }
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    let code: string | undefined;
    let details: unknown;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
      code = body?.code;
      details = body;
    } catch {
      // keep fallback
    }
    throw new ApiError(message, response.status, code, details);
  }

  return response.json() as Promise<T>;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, init, true);
}
