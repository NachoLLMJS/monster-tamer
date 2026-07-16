import assert from 'node:assert/strict';
import { test } from 'node:test';
import { privateKeyToAccount } from 'viem/accounts';
import { createApp } from '../server/app.js';
import { createMemoryRepository } from '../server/repository.js';

const PRIVATE_KEY = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

async function startTestServer() {
  const repository = createMemoryRepository();
  const app = createApp({
    repository,
    jwtSecret: 'test-secret-that-is-definitely-long-enough-for-auth',
    authOrigin: 'https://monster-tamer-production.up.railway.app',
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  return {
    repository,
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
  };
}

async function authenticate(baseUrl, account) {
  const challengeResponse = await fetch(`${baseUrl}/api/auth/nonce`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ wallet: account.address }),
  });
  assert.equal(challengeResponse.status, 200);
  const challenge = await challengeResponse.json();
  const signature = await account.signMessage({ message: challenge.message });
  const verifyResponse = await fetch(`${baseUrl}/api/auth/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ wallet: account.address, nonce: challenge.nonce, signature }),
  });
  assert.equal(verifyResponse.status, 200);
  return { challenge, signature, ...(await verifyResponse.json()) };
}

function authorized(token, body) {
  return {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

test('one wallet can create and list multiple independent characters', async (t) => {
  const { server, baseUrl } = await startTestServer();
  t.after(() => server.close());
  const account = privateKeyToAccount(PRIVATE_KEY);
  const { token } = await authenticate(baseUrl, account);

  const empty = await fetch(`${baseUrl}/api/characters`, authorized(token));
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), { characters: [] });

  const firstResponse = await fetch(`${baseUrl}/api/characters`, authorized(token, { name: 'Robin Ranger' }));
  const secondResponse = await fetch(`${baseUrl}/api/characters`, authorized(token, { name: 'Chain Scout' }));
  assert.equal(firstResponse.status, 201);
  assert.equal(secondResponse.status, 201);
  const first = await firstResponse.json();
  const second = await secondResponse.json();
  assert.notEqual(first.id, second.id);

  const listResponse = await fetch(`${baseUrl}/api/characters`, authorized(token));
  const listed = await listResponse.json();
  assert.equal(listed.characters.length, 2);
  assert.deepEqual(listed.characters.map((character) => character.name).sort(), ['Chain Scout', 'Robin Ranger']);
  assert.equal('progress' in listed.characters[0], false, 'list responses stay lightweight');

  const saveResponse = await fetch(`${baseUrl}/api/characters/${first.id}/progress`, {
    ...authorized(token, { progress: { map: 'plaza', level: 4 }, version: 0 }),
    method: 'PUT',
  });
  assert.equal(saveResponse.status, 200);
  const saved = await saveResponse.json();
  assert.equal(saved.progressVersion, 1);

  const selectedResponse = await fetch(`${baseUrl}/api/characters/${first.id}`, authorized(token));
  assert.equal(selectedResponse.status, 200);
  assert.deepEqual((await selectedResponse.json()).progress, { map: 'plaza', level: 4 });

  const untouchedResponse = await fetch(`${baseUrl}/api/characters/${second.id}`, authorized(token));
  assert.deepEqual((await untouchedResponse.json()).progress, {});
});

test('a wallet cannot load another wallet character and names remain globally unique', async (t) => {
  const { server, baseUrl } = await startTestServer();
  t.after(() => server.close());
  const firstAccount = privateKeyToAccount(PRIVATE_KEY);
  const secondAccount = privateKeyToAccount('0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd');
  const firstAuth = await authenticate(baseUrl, firstAccount);
  const secondAuth = await authenticate(baseUrl, secondAccount);

  const createResponse = await fetch(`${baseUrl}/api/characters`, authorized(firstAuth.token, { name: 'Unique Hero' }));
  const character = await createResponse.json();

  const forbiddenResponse = await fetch(`${baseUrl}/api/characters/${character.id}`, authorized(secondAuth.token));
  assert.equal(forbiddenResponse.status, 404);

  const duplicateResponse = await fetch(`${baseUrl}/api/characters`, authorized(secondAuth.token, { name: 'unique hero' }));
  assert.equal(duplicateResponse.status, 409);
  assert.equal((await duplicateResponse.json()).error, 'name_taken');
});

test('a nonce cannot be replayed', async (t) => {
  const { server, baseUrl } = await startTestServer();
  t.after(() => server.close());
  const account = privateKeyToAccount(PRIVATE_KEY);
  const auth = await authenticate(baseUrl, account);
  const replay = await fetch(`${baseUrl}/api/auth/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ wallet: account.address, nonce: auth.challenge.nonce, signature: auth.signature }),
  });
  assert.equal(replay.status, 401);
});

test('wallet challenge is bound to the configured production origin', async (t) => {
  const { server, baseUrl } = await startTestServer();
  t.after(() => server.close());
  const account = privateKeyToAccount(PRIVATE_KEY);
  const response = await fetch(`${baseUrl}/api/auth/nonce`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ wallet: account.address }),
  });
  const challenge = await response.json();
  assert.match(challenge.message, /^monster-tamer-production\.up\.railway\.app wants you to sign in/m);
  assert.match(challenge.message, /^URI: https:\/\/monster-tamer-production\.up\.railway\.app$/m);
  assert.match(challenge.message, /^Version: 1$/m);
  assert.match(challenge.message, /^Chain ID: 4663$/m);
});
