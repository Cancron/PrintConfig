const AUTH_REDIRECT_STORAGE_KEY = 'printconfig.authRedirect';
const AUTH_PATHS = new Set(['/signin', '/signup']);
const URL_BASE = 'https://printconfig.local';

function readStatePath(state: unknown): { found: boolean; value?: unknown } {
  if (!state || typeof state !== 'object' || !('from' in state)) {
    return { found: false };
  }

  return { found: true, value: (state as { from?: unknown }).from };
}

export function sanitizeAuthRedirect(value: unknown): string {
  if (typeof value !== 'string') return '/';

  const candidate = value.trim();
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) return '/';

  try {
    const parsed = new URL(candidate, URL_BASE);
    if (parsed.origin !== URL_BASE) return '/';

    const normalizedPath = parsed.pathname.replace(/\/+$/, '').toLowerCase() || '/';
    if (AUTH_PATHS.has(normalizedPath)) return '/';

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/';
  }
}

export function rememberAuthRedirect(value: unknown): string {
  const destination = sanitizeAuthRedirect(value);

  try {
    window.sessionStorage.setItem(AUTH_REDIRECT_STORAGE_KEY, destination);
  } catch {
    // Router state still preserves the destination when storage is unavailable.
  }

  return destination;
}

export function resolveAuthRedirect(state?: unknown): string {
  const statePath = readStatePath(state);
  if (statePath.found) return sanitizeAuthRedirect(statePath.value);

  try {
    return sanitizeAuthRedirect(window.sessionStorage.getItem(AUTH_REDIRECT_STORAGE_KEY));
  } catch {
    return '/';
  }
}

export function clearAuthRedirect() {
  try {
    window.sessionStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY);
  } catch {
    // Nothing else is required when storage is unavailable.
  }
}

export function consumeAuthRedirect(state?: unknown): string {
  const destination = resolveAuthRedirect(state);
  clearAuthRedirect();
  return destination;
}
