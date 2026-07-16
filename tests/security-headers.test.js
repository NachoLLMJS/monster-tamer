import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createApp } from '../server/app.js';
import { createMemoryRepository } from '../server/repository.js';

function parsePolicy(policy) {
  return Object.fromEntries(policy.split(';').map((directive) => {
    const [name, ...sources] = directive.trim().split(/\s+/);
    return [name, sources];
  }));
}

test('security policy allows Phaser blobs but only approved script and network origins', async (t) => {
  const app = createApp({
    repository: createMemoryRepository(),
    jwtSecret: 'test-secret-that-is-definitely-long-enough-for-auth',
    staticRoot: fileURLToPath(new URL('../', import.meta.url)),
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => server.close());
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const paths = ['/api/health', '/', '/src/main.js', '/assets/data/items.json'];
  const responses = await Promise.all(paths.map(async (path) => {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200, `${path} must be served`);
    return {
      path,
      policy: response.headers.get('content-security-policy') ?? '',
      cacheControl: response.headers.get('cache-control') ?? '',
    };
  }));
  const policies = responses.map(({ policy }) => policy);
  assert.ok(policies.every((policy) => policy === policies[0]), 'CSP must cover API and every static response');
  for (const response of responses.filter(({ path }) => path !== '/assets/data/items.json')) {
    assert.equal(response.cacheControl, 'no-store', `${response.path} must not survive across deployments`);
  }

  const directives = parsePolicy(policies[0]);
  assert.deepEqual(directives['img-src'], ["'self'", 'data:', 'blob:']);
  assert.deepEqual(directives['script-src'], ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net']);
  assert.deepEqual(directives['connect-src'], ["'self'", 'https://rpc.mainnet.chain.robinhood.com']);
  assert.deepEqual(directives['frame-src'], ["'none'"]);
  assert.deepEqual(directives['frame-ancestors'], ["'none'"]);
  assert.equal(policies[0].includes("'unsafe-eval'"), false);
  assert.equal(policies[0].includes('*'), false);
});
