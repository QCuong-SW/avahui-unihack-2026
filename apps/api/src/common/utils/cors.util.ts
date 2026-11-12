/**
 * Evaluates whether a request Origin header is permitted by configured CORS rules.
 * Supports comma-separated exact origins and wildcard subdomains such as `https://*.pages.dev`.
 */
export function parseCorsOrigins(rawCorsOrigin?: string): string[] {
  return (rawCorsOrigin || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

/**
 * Checks whether an incoming HTTP Origin header is authorized.
 */
export function isAllowedCorsOrigin(
  origin: string | undefined,
  configuredOrigins: string[],
  isProduction: boolean,
): boolean {
  if (!origin) return true;

  const normalizedOrigin = origin.trim().replace(/\/+$/, '');
  for (const allowed of configuredOrigins) {
    if (allowed === normalizedOrigin) {
      return true;
    }
    if (allowed.includes('*.')) {
      const escaped = allowed
        .replace(/[.+?^${}()|[\]\\*]/g, '\\$&')
        .replace(/\\\*\\\./g, '([a-z0-9-]+\\.)+');
      if (new RegExp(`^${escaped}$`, 'i').test(normalizedOrigin)) {
        return true;
      }
    }
  }

  return (
    !isProduction &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedOrigin)
  );
}
