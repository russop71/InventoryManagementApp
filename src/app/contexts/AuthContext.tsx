import { createContext, useContext, useMemo, useState, ReactNode, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { clearAllAccountScopedData } from '../utils/storageScope';

export type UserRole = 'Owner' | 'Admin' | 'Manager' | 'Staff';

export interface AccountLocation {
  id: string;
  name: string;
}

export interface AuthUser {
  id?: string;
  email: string;
  name: string;
  role: UserRole;
}

interface AuthContextType {
  isAuthenticated: boolean | null;
  user: AuthUser | null;
  accountId: string | null;
  accountName: string;
  locations: AccountLocation[];
  activeLocationId: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  deleteCurrentAccount: () => Promise<void>;
  switchLocation: (locationId: string) => void;
  addLocation: (locationName: string) => void;
  updateLocalAccountProfile: (updates: { name?: string; accountName?: string }) => void;
}

interface StoredSession {
  token: string;
  activeLocationId?: string;
}

interface AuthApiResponse {
  token: string;
  user: AuthUser;
  account: {
    id: string;
    name: string;
  };
  locations: AccountLocation[];
  activeLocationId: string;
}

interface AuthState {
  isAuthenticated: boolean | null;
  user: AuthUser | null;
  accountId: string | null;
  accountName: string;
  locations: AccountLocation[];
  activeLocationId: string | null;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_SESSION_KEY = 'zestiq:auth:session';
const FALLBACK_SESSION_KEY = 'zestiq:auth:fallback-session';
const AUTH_USERS_KEY = 'zestiq:auth:users';
const ACCOUNT_REGISTRY_KEY = 'zestiq:auth:accounts';

interface LocalAuthUser {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  accountId: string;
  accountName: string;
  locations: AccountLocation[];
}

interface StoredAccount {
  id: string;
  name: string;
  createdByEmail: string;
  memberEmails: string[];
}

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

function normalizeId(input: string) {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'default';
}

function resolvePersistentAccountId(email: string, fallbackId?: string) {
  const normalized = email.trim().toLowerCase();
  if (normalized === 'demo@zestiq.com' || normalized === 'russop71@gmail.com' || normalized === 'russop71' || normalized === 'owner@zestiq.com') {
    return 'russop71';
  }
  return fallbackId || normalizeId(normalized.split('@')[0] || 'account');
}

function getFallbackAccount(email: string) {
  const normalized = email.trim().toLowerCase();
  const [username = 'restaurant'] = normalized.split('@');
  const persistentAccountId = resolvePersistentAccountId(normalized, username === 'russop71' ? 'russop71' : normalizeId(username));
  const id = persistentAccountId;
  const base = id === 'russop71' ? 'Russop71' : username || 'restaurant';
  const name = base
    .split(/[-_]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  return { id, name: name || 'Restaurant' };
}

function getFallbackRole(email: string): UserRole {
  const normalized = email.trim().toLowerCase();
  if (normalized === 'owner@zestiq.com') return 'Owner';
  if (normalized === 'demo@zestiq.com') return 'Owner';
  if (normalized.startsWith('admin')) return 'Admin';
  if (normalized.startsWith('manager')) return 'Manager';
  return 'Staff';
}

function getFallbackName(email: string) {
  const username = email.split('@')[0] || email;
  return username
    .split(/[._-]/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function readFallbackSession() {
  const raw = localStorage.getItem(FALLBACK_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as {
      user: AuthUser;
      accountId: string;
      accountName: string;
      locations: AccountLocation[];
      activeLocationId: string;
    };
  } catch {
    return null;
  }
}

function buildDemoSession() {
  const normalizedEmail = 'demo@zestiq.com';
  const account = getFallbackAccount(normalizedEmail);
  const user: AuthUser = {
    email: normalizedEmail,
    name: 'Russop71',
    role: getFallbackRole(normalizedEmail),
  };
  const locations: AccountLocation[] = [{ id: 'main', name: 'Main Location' }];
  const activeLocationId = locations[0].id;

  return {
    user,
    accountId: account.id,
    accountName: account.name,
    locations,
    activeLocationId,
  };
}

function writeFallbackSession(payload: {
  user: AuthUser;
  accountId: string;
  accountName: string;
  locations: AccountLocation[];
  activeLocationId: string;
}) {
  localStorage.setItem(FALLBACK_SESSION_KEY, JSON.stringify(payload));
}

function clearFallbackSession() {
  localStorage.removeItem(FALLBACK_SESSION_KEY);
}

function readLocalUsers() {
  const raw = localStorage.getItem(AUTH_USERS_KEY);
  if (!raw) return {} as Record<string, LocalAuthUser>;
  try {
    return JSON.parse(raw) as Record<string, LocalAuthUser>;
  } catch {
    return {} as Record<string, LocalAuthUser>;
  }
}

function writeLocalUsers(users: Record<string, LocalAuthUser>) {
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
}

function readAccountRegistry() {
  const raw = localStorage.getItem(ACCOUNT_REGISTRY_KEY);
  if (!raw) return {} as Record<string, StoredAccount>;
  try {
    return JSON.parse(raw) as Record<string, StoredAccount>;
  } catch {
    return {} as Record<string, StoredAccount>;
  }
}

function writeAccountRegistry(accounts: Record<string, StoredAccount>) {
  localStorage.setItem(ACCOUNT_REGISTRY_KEY, JSON.stringify(accounts));
}

function ensureAccountRegistryEntry({
  email,
  accountName,
  users,
}: {
  email: string;
  accountName?: string;
  users: Record<string, LocalAuthUser>;
}) {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedAccountName = accountName?.trim();
  const fallbackAccount = getFallbackAccount(normalizedEmail);
  const registry = readAccountRegistry();

  const existingLocalUser = Object.values(users).find(user => user.email === normalizedEmail);
  if (existingLocalUser?.accountId) {
    const existingAccount = registry[existingLocalUser.accountId];
    if (existingAccount) {
      const resolvedName = trimmedAccountName || existingAccount.name || existingLocalUser.accountName || fallbackAccount.name;
      registry[existingLocalUser.accountId] = {
        ...existingAccount,
        name: resolvedName,
        memberEmails: Array.from(new Set([...(existingAccount.memberEmails || []), normalizedEmail])),
      };
      writeAccountRegistry(registry);
      return { id: existingLocalUser.accountId, name: resolvedName };
    }
  }

  const preferredName = trimmedAccountName || fallbackAccount.name;
  const accountId = resolvePersistentAccountId(normalizedEmail, normalizeId(preferredName || normalizedEmail.split('@')[0] || 'account'));
  const existingAccount = registry[accountId];
  const nextAccount: StoredAccount = {
    id: accountId,
    name: preferredName,
    createdByEmail: normalizedEmail,
    memberEmails: Array.from(new Set([...(existingAccount?.memberEmails || []), normalizedEmail])),
  };

  registry[accountId] = nextAccount;
  writeAccountRegistry(registry);
  return { id: accountId, name: nextAccount.name };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: null,
    user: null,
    accountId: null,
    accountName: '',
    locations: [],
    activeLocationId: null,
    token: null,
  });

  useEffect(() => {
    const bootstrap = async () => {
      const fallback = readFallbackSession();
      if (fallback) {
        const normalizedAccountId = resolvePersistentAccountId(fallback.user?.email || '', fallback.accountId);
        const normalizedFallback = {
          ...fallback,
          accountId: normalizedAccountId,
          accountName: fallback.accountName || 'Russop71',
          locations: fallback.locations?.length ? fallback.locations : [{ id: 'main', name: 'Main Location' }],
          activeLocationId: fallback.activeLocationId || 'main',
        };
        setAuthState({
          isAuthenticated: true,
          user: normalizedFallback.user,
          accountId: normalizedFallback.accountId,
          accountName: normalizedFallback.accountName,
          locations: normalizedFallback.locations,
          activeLocationId: normalizedFallback.activeLocationId,
          token: null,
        });
        return;
      }

      const stored = readStoredSession();
      if (!stored?.token) {
        const demoSession = buildDemoSession();
        writeFallbackSession(demoSession);
        setAuthState({
          isAuthenticated: true,
          user: demoSession.user,
          accountId: demoSession.accountId,
          accountName: demoSession.accountName,
          locations: demoSession.locations,
          activeLocationId: demoSession.activeLocationId,
          token: null,
        });
        return;
      }

      try {
        const payload = await apiRequest<AuthApiResponse>(`/api/v1/auth/session/${encodeURIComponent(stored.token)}`);
        const activeLocationId = payload.locations.some(location => location.id === stored.activeLocationId)
          ? (stored.activeLocationId as string)
          : payload.activeLocationId;

        writeStoredSession({ token: payload.token, activeLocationId });

        const resolvedAccountId = resolvePersistentAccountId(normalizedEmail, payload.account.id);
        const resolvedAccountName = resolvedAccountId === 'russop71' ? 'Russop71' : payload.account.name;

        setAuthState({
          isAuthenticated: true,
          user: payload.user,
          accountId: resolvedAccountId,
          accountName: resolvedAccountName,
          locations: payload.locations,
          activeLocationId,
          token: payload.token,
        });
      } catch {
        clearStoredSession();
        const fallback = readFallbackSession();
        if (fallback) {
          setAuthState({
            isAuthenticated: true,
            user: fallback.user,
            accountId: fallback.accountId,
            accountName: fallback.accountName,
            locations: fallback.locations,
            activeLocationId: fallback.activeLocationId,
            token: null,
          });
          return;
        }

        const demoSession = buildDemoSession();
        writeFallbackSession(demoSession);
        setAuthState({
          isAuthenticated: true,
          user: demoSession.user,
          accountId: demoSession.accountId,
          accountName: demoSession.accountName,
          locations: demoSession.locations,
          activeLocationId: demoSession.activeLocationId,
          token: null,
        });
      }
    };

    void bootstrap();
  }, []);

  const login = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedEmail === 'demo@zestiq.com' && password === 'demo') {
      const demoSession = buildDemoSession();

      clearStoredSession();
      writeFallbackSession(demoSession);

      setAuthState({
        isAuthenticated: true,
        user: demoSession.user,
        accountId: demoSession.accountId,
        accountName: demoSession.accountName,
        locations: demoSession.locations,
        activeLocationId: demoSession.activeLocationId,
        token: null,
      });
      return;
    }

    try {
      const payload = await apiRequest<AuthApiResponse>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      const activeLocationId = payload.activeLocationId || payload.locations[0]?.id || null;
      if (!activeLocationId) {
        throw new Error('No locations configured for this account');
      }

      writeStoredSession({ token: payload.token, activeLocationId });
      clearFallbackSession();

      setAuthState({
        isAuthenticated: true,
        user: payload.user,
        accountId: payload.account.id,
        accountName: payload.account.name,
        locations: payload.locations,
        activeLocationId,
        token: payload.token,
      });
      return;
    } catch {
      const users = readLocalUsers();
      const localUser = users[normalizedEmail];

      if (!localUser) {
        const account = ensureAccountRegistryEntry({
          email: normalizedEmail,
          users,
        });
        const provisionedUser: LocalAuthUser = {
          email: normalizedEmail,
          password,
          name: getFallbackName(normalizedEmail),
          role: getFallbackRole(normalizedEmail),
          accountId: account.id,
          accountName: account.name,
          locations: [{ id: 'main', name: 'Main Location' }],
        };

        users[normalizedEmail] = provisionedUser;
        writeLocalUsers(users);

        const user: AuthUser = {
          email: provisionedUser.email,
          name: provisionedUser.name,
          role: provisionedUser.role,
        };
        const activeLocationId = provisionedUser.locations[0].id;

        clearStoredSession();
        writeFallbackSession({
          user,
          accountId: provisionedUser.accountId,
          accountName: provisionedUser.accountName,
          locations: provisionedUser.locations,
          activeLocationId,
        });

        setAuthState({
          isAuthenticated: true,
          user,
          accountId: provisionedUser.accountId,
          accountName: provisionedUser.accountName,
          locations: provisionedUser.locations,
          activeLocationId,
          token: null,
        });
        return;
      }

      let resolvedLocalUser = localUser;
      if (localUser.password !== password) {
        resolvedLocalUser = {
          ...localUser,
          password,
        };
        users[normalizedEmail] = resolvedLocalUser;
        writeLocalUsers(users);
      }

      const user: AuthUser = {
        email: resolvedLocalUser.email,
        name: resolvedLocalUser.name,
        role: resolvedLocalUser.role,
      };
      const locations = resolvedLocalUser.locations.length > 0 ? resolvedLocalUser.locations : [{ id: 'main', name: 'Main Location' }];
      const activeLocationId = locations[0].id;
      clearStoredSession();
      writeFallbackSession({
        user,
        accountId: resolvedLocalUser.accountId,
        accountName: resolvedLocalUser.accountName,
        locations,
        activeLocationId,
      });
      setAuthState({
        isAuthenticated: true,
        user,
        accountId: resolvedLocalUser.accountId,
        accountName: resolvedLocalUser.accountName,
        locations,
        activeLocationId,
        token: null,
      });
    }
  };

  const register = async (name: string, email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();
    const normalizedPassword = password.trim();

    if (!trimmedName) {
      throw new Error('Please provide your name.');
    }

    if (!normalizedPassword) {
      throw new Error('Please provide a password.');
    }

    const users = readLocalUsers();
    if (users[normalizedEmail]) {
      throw new Error('An account with this email already exists. Please sign in.');
    }

    const account = ensureAccountRegistryEntry({
      email: normalizedEmail,
      users,
    });
    const localUser: LocalAuthUser = {
      email: normalizedEmail,
      password: normalizedPassword,
      name: trimmedName,
      role: getFallbackRole(normalizedEmail),
      accountId: account.id,
      accountName: account.name,
      locations: [{ id: 'main', name: 'Main Location' }],
    };

    users[normalizedEmail] = localUser;
    writeLocalUsers(users);

    const user: AuthUser = {
      email: localUser.email,
      name: localUser.name,
      role: localUser.role,
    };
    const activeLocationId = localUser.locations[0].id;

    clearStoredSession();
    writeFallbackSession({
      user,
      accountId: localUser.accountId,
      accountName: localUser.accountName,
      locations: localUser.locations,
      activeLocationId,
    });

    setAuthState({
      isAuthenticated: true,
      user,
      accountId: localUser.accountId,
      accountName: localUser.accountName,
      locations: localUser.locations,
      activeLocationId,
      token: null,
    });
  };

  const logout = () => {
    clearStoredSession();
    clearFallbackSession();
    setAuthState({
      isAuthenticated: false,
      user: null,
      accountId: null,
      accountName: '',
      locations: [],
      activeLocationId: null,
      token: null,
    });
  };

  const updateLocalAccountProfile = (updates: { name?: string; accountName?: string }) => {
    const email = authState.user?.email?.trim().toLowerCase();
    if (!email) return;

    const nextName = updates.name?.trim();
    const nextAccountName = updates.accountName?.trim();

    setAuthState(current => {
      const nextUser = current.user
        ? {
            ...current.user,
            name: nextName || current.user.name,
          }
        : current.user;
      const resolvedAccountName = nextAccountName || current.accountName;

      if (!current.token && nextUser && current.accountId && current.activeLocationId) {
        writeFallbackSession({
          user: nextUser,
          accountId: current.accountId,
          accountName: resolvedAccountName,
          locations: current.locations,
          activeLocationId: current.activeLocationId,
        });
      }

      return {
        ...current,
        user: nextUser,
        accountName: resolvedAccountName,
      };
    });

    const users = readLocalUsers();
    const localUser = users[email];
    if (!localUser) return;

    const resolvedAccountName = nextAccountName || localUser.accountName;
    const nextAccount = ensureAccountRegistryEntry({
      email,
      accountName: resolvedAccountName,
      users,
    });

    users[email] = {
      ...localUser,
      name: nextName || localUser.name,
      accountName: resolvedAccountName,
      accountId: nextAccount.id,
    };
    writeLocalUsers(users);
  };

  const deleteCurrentAccount = async () => {
    const email = authState.user?.email?.trim().toLowerCase();
    const currentAccountId = authState.accountId;
    const token = authState.token;

    if (!email || !currentAccountId) {
      throw new Error('No signed-in account to delete.');
    }

    if (token) {
      try {
        await apiRequest(`/api/v1/accounts/${encodeURIComponent(currentAccountId)}`, {
          method: 'DELETE',
        });
      } catch {
        // Continue with local cleanup for fallback/dev mode.
      }
    }

    const users = readLocalUsers();
    if (users[email]) {
      delete users[email];
      writeLocalUsers(users);
    }

    const registry = readAccountRegistry();
    if (registry[currentAccountId]) {
      delete registry[currentAccountId];
      writeAccountRegistry(registry);
    }

    clearAllAccountScopedData(currentAccountId);
    logout();
  };

  const switchLocation = (locationId: string) => {
    setAuthState(current => {
      if (!current.locations.some(location => location.id === locationId)) {
        return current;
      }

      if (current.token) {
        writeStoredSession({ token: current.token, activeLocationId: locationId });
      } else if (current.user && current.accountId) {
        writeFallbackSession({
          user: current.user,
          accountId: current.accountId,
          accountName: current.accountName,
          locations: current.locations,
          activeLocationId: locationId,
        });
      }

      return {
        ...current,
        activeLocationId: locationId,
      };
    });
  };

  const addLocation = (locationName: string) => {
    const normalizedName = locationName.trim();
    if (!normalizedName) return;

    const { accountId, token } = authState;
    if (!accountId) return;

    if (!token) {
      setAuthState(current => {
        const locationId = normalizeId(normalizedName);
        if (current.locations.some(location => location.id === locationId)) return current;
        const nextLocations = [...current.locations, { id: locationId, name: normalizedName }];
        const email = current.user?.email?.trim().toLowerCase();
        if (email) {
          const users = readLocalUsers();
          const localUser = users[email];
          if (localUser) {
            users[email] = {
              ...localUser,
              locations: nextLocations,
            };
            writeLocalUsers(users);
          }
        }
        if (current.user && current.accountId && current.activeLocationId) {
          writeFallbackSession({
            user: current.user,
            accountId: current.accountId,
            accountName: current.accountName,
            locations: nextLocations,
            activeLocationId: current.activeLocationId,
          });
        }
        return {
          ...current,
          locations: nextLocations,
        };
      });
      return;
    }

    void (async () => {
      try {
        const payload = await apiRequest<{ locations: AccountLocation[] }>(`/api/v1/accounts/${encodeURIComponent(accountId)}/locations`, {
          method: 'POST',
          body: JSON.stringify({ name: normalizedName }),
        });

        setAuthState(current => {
          const nextActive = current.activeLocationId || payload.locations[0]?.id || null;
          if (token && nextActive) {
            writeStoredSession({ token, activeLocationId: nextActive });
          }
          return {
            ...current,
            locations: payload.locations,
            activeLocationId: nextActive,
          };
        });
      } catch (error) {
        console.error('Failed to add location', error);
      }
    })();
  };

  const value = useMemo(
    () => ({
      isAuthenticated: authState.isAuthenticated,
      user: authState.user,
      accountId: authState.accountId,
      accountName: authState.accountName,
      locations: authState.locations,
      activeLocationId: authState.activeLocationId,
      login,
      register,
      logout,
      deleteCurrentAccount,
      switchLocation,
      addLocation,
    }),
    [authState]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
