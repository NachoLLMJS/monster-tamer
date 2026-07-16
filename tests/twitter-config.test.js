import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../server/app.js';
import { createMemoryRepository } from '../server/repository.js';

test('default Twitter configuration points to the official Tameria account', async (t) => {
  const app = createApp({
    repository: createMemoryRepository(),
    jwtSecret: 'test-secret-that-is-definitely-long-enough-for-auth',
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => server.close());

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/config`);
  assert.deepEqual(await response.json(), { twitterUrl: 'https://x.com/TameriaRH' });
});
