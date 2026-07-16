import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPlayerCharacter, listPlayerCharacters, loadPlayerCharacter, saveRemoteProgress } from '../src/profile/profile-api.js';

test('character API calls are scoped to the authenticated character routes', async (t) => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url === '/api/characters' && options.method === 'POST') {
      return new Response(JSON.stringify({ id: 'char-1', name: 'Robin Ranger', progress: {}, progressVersion: 0 }), { status: 201, headers: { 'content-type': 'application/json' } });
    }
    if (url === '/api/characters') {
      return new Response(JSON.stringify({ characters: [{ id: 'char-1', name: 'Robin Ranger' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url === '/api/characters/char-1' && !options.method) {
      return new Response(JSON.stringify({ id: 'char-1', name: 'Robin Ranger', progress: {}, progressVersion: 0 }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url === '/api/characters/char-1/progress') {
      return new Response(JSON.stringify({ id: 'char-1', name: 'Robin Ranger', progress: { level: 2 }, progressVersion: 1 }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`Unexpected fetch ${url}`);
  };
  t.after(() => { global.fetch = originalFetch; });

  const session = { token: 'session-token', wallet: '0xabc' };
  assert.equal((await listPlayerCharacters(session))[0].id, 'char-1');
  const created = await createPlayerCharacter(session, 'Robin Ranger');
  assert.equal(created.id, 'char-1');
  const selected = await loadPlayerCharacter(session, 'char-1');
  assert.equal(selected.progressVersion, 0);
  session.character = selected;
  const saved = await saveRemoteProgress(session, { level: 2 }, 0);
  assert.equal(saved.progressVersion, 1);

  assert.deepEqual(calls.map((call) => call.url), [
    '/api/characters',
    '/api/characters',
    '/api/characters/char-1',
    '/api/characters/char-1/progress',
  ]);
  assert.ok(calls.every((call) => call.options.headers.Authorization === 'Bearer session-token'));
});
