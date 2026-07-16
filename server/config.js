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
