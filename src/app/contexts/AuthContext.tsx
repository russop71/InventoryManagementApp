import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiRequest } from '../utils/api';
import { clearAllAccountScopedData } from '../utils/storageScope';
import { clearDemoSessionReset } from '../utils/demoSession.js';

export type UserRole = 'Owner' | 'Admin' | 'Manager' | 'BOH Manager' | 'FOH Manager' | 'Staff';

export interface AccountLocation {
  id: string;
  name: string;
}

export type OnboardingStepId = 'restaurant' | 'location' | 'suppliers' | 'inventory' | 'recipes' | 'count';
export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'dismissed';

export interface OnboardingProgress {
  status: OnboardingStatus;
  currentStep: OnboardingStepId;
  completedSteps: OnboardingStepId[];
  skippedSteps: OnboardingStepId[];
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
}

export interface AuthUser {
  id?: string;
  email: string;
  name: string;
  role: UserRole;
  platformAdmin?: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean | null;
  user: AuthUser | null;
  accountId: string | null;
  accountName: string;
  billingStatus: string;
  productAccess: boolean;
  features: { scheduling: boolean };
  onboarding: OnboardingProgress;
  locations: AccountLocation[];
  activeLocationId: string | null;
  token: string | null;
  mfaRequired: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginDemo: () => Promise<void>;
  register: (name: string, companyName: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  changePassword: (password: string) => Promise<void>;
  deleteCurrentAccount: () => Promise<void>;
  switchLocation: (locationId: string) => void;
  addLocation: (locationName: string) => Promise<void>;
  updateLocation: (locationId: string, locationName: string) => Promise<void>;
  updateAccountProfile: (accountName: string) => Promise<void>;
  updateOnboarding: (updates: Partial<OnboardingProgress>) => Promise<OnboardingProgress>;
  refreshSession: () => Promise<void>;
  completeMfa: (factorId: string, code: string) => Promise<void>;
  updateLocalAccountProfile: (updates: { name?: string; accountName?: string }) => void;
}

interface StoredSession {
  token: string;
  accountId?: string;
  refreshToken?: string | null;
  expiresAt?: number | null;
  activeLocationId?: string;
}

interface AuthApiResponse {
  token: string;
  refreshToken?: string | null;
  expiresAt?: number | null;
  user: AuthUser;
  account: {
    id: string;
    name: string;
    onboarding?: OnboardingProgress;
    billingStatus?: string;
    productAccess?: boolean;
    features?: { scheduling?: boolean };
  };
  locations: AccountLocation[];
  activeLocationId: string;
  mfaRequired?: boolean;
}

interface AuthState {
  isAuthenticated: boolean | null;
  user: AuthUser | null;
  accountId: string | null;
  accountName: string;
  billingStatus: string;
  productAccess: boolean;
  features: { scheduling: boolean };
  onboarding: OnboardingProgress;
  locations: AccountLocation[];
  activeLocationId: string | null;
  token: string | null;
  mfaRequired: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_SESSION_KEY = 'zestiq:auth:session';
const DEFAULT_ONBOARDING: OnboardingProgress = {
  status: 'not_started',
  currentStep: 'restaurant',
  completedSteps: [],
  skippedSteps: [],
  startedAt: null,
  completedAt: null,
  updatedAt: null,
};

function readStoredSession(): StoredSession | null {
  const raw = localStorage.getItem(AUTH_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

function writeStoredSession(session: StoredSession) {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

function clearStoredSession() {
  localStorage.removeItem(AUTH_SESSION_KEY);
}

function signedOutState(): AuthState {
  return {
    isAuthenticated: false,
    user: null,
    accountId: null,
    accountName: '',
    billingStatus: 'not_configured',
    productAccess: false,
    features: { scheduling: false },
    onboarding: DEFAULT_ONBOARDING,
    locations: [],
    activeLocationId: null,
    token: null,
    mfaRequired: false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({ ...signedOutState(), isAuthenticated: null });

  const applySession = (payload: AuthApiResponse, previous?: StoredSession | null) => {
    const activeLocationId = payload.locations.some(location => location.id === previous?.activeLocationId)
      ? (previous?.activeLocationId as string)
      : payload.activeLocationId || payload.locations[0]?.id || null;
    if (!activeLocationId) throw new Error('No locations are configured for this company account');

    writeStoredSession({
      token: payload.token,
      accountId: payload.account.id,
      refreshToken: payload.refreshToken ?? previous?.refreshToken ?? null,
      expiresAt: payload.expiresAt ?? previous?.expiresAt ?? null,
      activeLocationId,
    });
    setAuthState({
      isAuthenticated: true,
      user: payload.user,
      accountId: payload.account.id,
      accountName: payload.account.name,
      billingStatus: payload.account.billingStatus || 'not_configured',
      productAccess: payload.account.productAccess === true,
      // Optional modules are deny-by-default. An older or partially migrated
      // account must never receive Scheduling unless the server explicitly
      // grants it.
      features: { scheduling: payload.account.features?.scheduling === true },
      onboarding: payload.account.onboarding || DEFAULT_ONBOARDING,
      locations: payload.locations,
      activeLocationId,
      token: payload.token,
      mfaRequired: payload.mfaRequired === true,
    });
  };

  useEffect(() => {
    const bootstrap = async () => {
      const stored = readStoredSession();
      if (!stored?.token) {
        setAuthState(signedOutState());
        return;
      }

      try {
        const payload = await apiRequest<AuthApiResponse>('/api/v1/auth/session');
        applySession(payload, stored);
        return;
      } catch {
        if (stored.refreshToken) {
          try {
            const refreshed = await apiRequest<AuthApiResponse>('/api/v1/auth/refresh', {
              method: 'POST',
              body: JSON.stringify({ refreshToken: stored.refreshToken }),
            });
            applySession(refreshed, stored);
            return;
          } catch {
            // The session is expired or revoked.
          }
        }
      }

      clearStoredSession();
      if (stored.accountId) clearAllAccountScopedData(stored.accountId);
      setAuthState(signedOutState());
    };

    void bootstrap();
  }, []);

  const login = async (email: string, password: string) => {
    const payload = await apiRequest<AuthApiResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    applySession(payload);
  };

  const loginDemo = async () => {
    clearDemoSessionReset();
    const payload = await apiRequest<AuthApiResponse>('/api/v1/auth/demo', { method: 'POST' });
    applySession(payload);
  };

  const register = async (name: string, companyName: string, email: string, password: string) => {
    const payload = await apiRequest<AuthApiResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, companyName, email, password }),
    });
    applySession(payload);
  };

  const refreshSession = async () => {
    const stored = readStoredSession();
    if (!stored?.token) throw new Error('Sign in is required');
    const payload = await apiRequest<AuthApiResponse>('/api/v1/auth/session');
    applySession(payload, stored);
  };

  const completeMfa = async (factorId: string, code: string) => {
    const previous = readStoredSession();
    const payload = await apiRequest<AuthApiResponse>('/api/v1/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({ factorId, code }),
    });
    applySession(payload, previous);
  };

  const logout = () => {
    void apiRequest<{ success: boolean }>('/api/v1/auth/logout', { method: 'POST' }).catch(() => {});
    if (authState.accountId) clearAllAccountScopedData(authState.accountId);
    clearStoredSession();
    setAuthState(signedOutState());
  };

  const changePassword = async (password: string) => {
    await apiRequest<{ success: boolean }>('/api/v1/auth/password', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  };

  const updateLocalAccountProfile = (updates: { name?: string; accountName?: string }) => {
    const nextName = updates.name?.trim();
    const nextAccountName = updates.accountName?.trim();
    setAuthState(current => ({
      ...current,
      user: current.user && nextName ? { ...current.user, name: nextName } : current.user,
      accountName: nextAccountName || current.accountName,
    }));
  };

  const deleteCurrentAccount = async () => {
    const currentAccountId = authState.accountId;
    if (!currentAccountId) throw new Error('No signed-in account to delete.');
    await apiRequest(`/api/v1/accounts/${encodeURIComponent(currentAccountId)}`, {
      method: 'DELETE',
    });
    clearAllAccountScopedData(currentAccountId);
    logout();
  };

  const switchLocation = (locationId: string) => {
    setAuthState(current => {
      if (!current.locations.some(location => location.id === locationId)) return current;
      const stored = readStoredSession();
      if (stored) writeStoredSession({ ...stored, activeLocationId: locationId });
      return { ...current, activeLocationId: locationId };
    });
  };

  const addLocation = async (locationName: string) => {
    const normalizedName = locationName.trim();
    const accountId = authState.accountId;
    if (!normalizedName || !accountId) return;

    const payload = await apiRequest<{ locations: AccountLocation[] }>(`/api/v1/accounts/${encodeURIComponent(accountId)}/locations`, {
      method: 'POST',
      body: JSON.stringify({ name: normalizedName }),
    });
    setAuthState(current => {
      const nextActive = current.activeLocationId || payload.locations[0]?.id || null;
      const stored = readStoredSession();
      if (stored && nextActive) writeStoredSession({ ...stored, activeLocationId: nextActive });
      return { ...current, locations: payload.locations, activeLocationId: nextActive };
    });
  };

  const updateLocation = async (locationId: string, locationName: string) => {
    const normalizedName = locationName.trim();
    const accountId = authState.accountId;
    if (!normalizedName || !accountId) return;
    const payload = await apiRequest<{ locations: AccountLocation[] }>(`/api/v1/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(locationId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: normalizedName }),
    });
    setAuthState(current => ({ ...current, locations: payload.locations }));
  };

  const updateAccountProfile = async (accountName: string) => {
    const normalizedName = accountName.trim();
    const accountId = authState.accountId;
    if (!normalizedName || !accountId) return;
    const payload = await apiRequest<{ account: { id: string; name: string; onboarding: OnboardingProgress } }>(`/api/v1/accounts/${encodeURIComponent(accountId)}/profile`, {
      method: 'PATCH',
      body: JSON.stringify({ name: normalizedName }),
    });
    setAuthState(current => ({
      ...current,
      accountName: payload.account.name,
      onboarding: payload.account.onboarding || current.onboarding,
    }));
  };

  const updateOnboarding = async (updates: Partial<OnboardingProgress>) => {
    const accountId = authState.accountId;
    if (!accountId) throw new Error('No company account is selected');
    const payload = await apiRequest<{ onboarding: OnboardingProgress }>(`/api/v1/accounts/${encodeURIComponent(accountId)}/onboarding`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    setAuthState(current => ({ ...current, onboarding: payload.onboarding }));
    return payload.onboarding;
  };

  const value = useMemo(
    () => ({
      isAuthenticated: authState.isAuthenticated,
      user: authState.user,
      accountId: authState.accountId,
      accountName: authState.accountName,
      billingStatus: authState.billingStatus,
      productAccess: authState.productAccess,
      features: authState.features,
      onboarding: authState.onboarding,
      locations: authState.locations,
      activeLocationId: authState.activeLocationId,
      token: authState.token,
      mfaRequired: authState.mfaRequired,
      login,
      loginDemo,
      register,
      logout,
      changePassword,
      deleteCurrentAccount,
      switchLocation,
      addLocation,
      updateLocation,
      updateAccountProfile,
      updateOnboarding,
      refreshSession,
      completeMfa,
      updateLocalAccountProfile,
    }),
    [authState],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
