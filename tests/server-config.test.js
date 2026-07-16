import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveAppOrigins, resolveAuthOrigin } from '../server/config.js';

test('production uses playtameria.com canonically while keeping Railway as an allowed legacy origin', () => {
  assert.deepEqual(
    resolveAppOrigins({ RAILWAY_PUBLIC_DOMAIN: 'monster-tamer-production.up.railway.app' }, true, 8080),
    {
      authOrigin: 'https://playtameria.com',
      allowedOrigins: [
        'https://playtameria.com',
        'https://monster-tamer-production.up.railway.app',
      ],
    },
  );
});

test('production ignores a stale Railway AUTH_ORIGIN in favor of playtameria.com', () => {
  assert.equal(
    resolveAppOrigins({
      AUTH_ORIGIN: 'https://monster-tamer-production.up.railway.app',
      RAILWAY_PUBLIC_DOMAIN: 'monster-tamer-production.up.railway.app',
    }, true, 8080).authOrigin,
    'https://playtameria.com',
  );
});

test('Railway public domain becomes the HTTPS SIWE origin', () => {
  assert.equal(
    resolveAuthOrigin({ RAILWAY_PUBLIC_DOMAIN: 'monster-tamer-production.up.railway.app' }, true, 8080),
    'https://monster-tamer-production.up.railway.app',
  );
});

test('local authentication origin uses the active local port', () => {
  assert.equal(resolveAuthOrigin({}, false, 3000), 'http://localhost:3000');
});

test('production refuses to start without a stable public authentication origin', () => {
  assert.throws(() => resolveAuthOrigin({}, true, 8080), /AUTH_ORIGIN/);
});
