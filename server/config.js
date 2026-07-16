export function resolveAuthOrigin(env, isProduction, port) {
  const configuredOrigin = env.AUTH_ORIGIN;
  const railwayOrigin = env.RAILWAY_PUBLIC_DOMAIN ? `https://${env.RAILWAY_PUBLIC_DOMAIN}` : null;
  const candidate = configuredOrigin || railwayOrigin || (isProduction ? null : `http://localhost:${port}`);
  if (!candidate) {
    throw new Error('AUTH_ORIGIN is required in production when RAILWAY_PUBLIC_DOMAIN is unavailable.');
  }
  const url = new URL(candidate);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('AUTH_ORIGIN must use http or https.');
  }
  return url.origin;
}

export function resolveAppOrigins(env, isProduction, port) {
  const canonicalEnv = isProduction
    ? { ...env, AUTH_ORIGIN: 'https://playtameria.com' }
    : env;
  const authOrigin = resolveAuthOrigin(canonicalEnv, isProduction, port);
  const allowedOrigins = new Set([authOrigin]);
  if (env.RAILWAY_PUBLIC_DOMAIN) {
    allowedOrigins.add(`https://${env.RAILWAY_PUBLIC_DOMAIN}`);
  }
  return { authOrigin, allowedOrigins: [...allowedOrigins] };
}
