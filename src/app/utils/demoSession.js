export const DEMO_SESSION_RESET_KEY = 'zestiq:demo-session-reset';

function sessionStore(storage) {
  return storage || globalThis.sessionStorage || null;
}

export function clearDemoSessionReset(storage) {
  sessionStore(storage)?.removeItem(DEMO_SESSION_RESET_KEY);
}

export function shouldResetDemoSession(dataVersion, storage) {
  return sessionStore(storage)?.getItem(DEMO_SESSION_RESET_KEY) !== dataVersion;
}

export function markDemoSessionReset(dataVersion, storage) {
  sessionStore(storage)?.setItem(DEMO_SESSION_RESET_KEY, dataVersion);
}
