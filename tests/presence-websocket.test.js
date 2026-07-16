import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import WebSocket from 'ws';
import { createApp } from '../server/app.js';
import { issueToken } from '../server/auth.js';
import { attachPresenceServer } from '../server/presence.js';
import { createMemoryRepository } from '../server/repository.js';

const JWT_SECRET = 'test-secret-that-is-definitely-long-enough-for-auth';
const WALLET_A = '0x0000000000000000000000000000000000000001';
const WALLET_B = '0x0000000000000000000000000000000000000002';

function nextMessage(socket, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('websocket_message_timeout')), 2_000);
    const onMessage = (raw) => {
      const message = JSON.parse(raw.toString());
      if (!predicate(message)) return;
      clearTimeout(timeout);
      socket.off('message', onMessage);
      resolve(message);
    };
    socket.on('message', onMessage);
  });
}

async function connect(url, joinMessage) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  socket.send(JSON.stringify(joinMessage));
  return socket;
}

test('authenticated players and spectators share live movement inside the same map room', async (t) => {
  const repository = createMemoryRepository();
  await repository.init();
  const alice = await repository.createCharacter({ wallet: WALLET_A, name: 'Alice', nameKey: 'alice' });
  const bob = await repository.createCharacter({ wallet: WALLET_B, name: 'Bob', nameKey: 'bob' });
  const app = createApp({ repository, jwtSecret: JWT_SECRET });
  const server = createServer(app);
  const presence = attachPresenceServer({ server, repository, jwtSecret: JWT_SECRET });
  server.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    await presence.close();
    await new Promise((resolve) => server.close(resolve));
  });
  const url = `ws://127.0.0.1:${server.address().port}/ws`;

  const aliceSocket = await connect(url, {
    type: 'join', token: issueToken(WALLET_A, JWT_SECRET), characterId: alice.id,
    area: 'main_1', x: 64, y: 128, direction: 'DOWN',
  });
  t.after(() => aliceSocket.close());
  const aliceSnapshot = await nextMessage(aliceSocket, (message) => message.type === 'snapshot');
  assert.deepEqual(aliceSnapshot.players, []);

  const bobJoined = nextMessage(aliceSocket, (message) => message.type === 'player_joined');
  const bobSocket = await connect(url, {
    type: 'join', token: issueToken(WALLET_B, JWT_SECRET), characterId: bob.id,
    area: 'main_1', x: 192, y: 128, direction: 'LEFT',
  });
  t.after(() => bobSocket.close());
  const bobSnapshot = await nextMessage(bobSocket, (message) => message.type === 'snapshot');
  assert.deepEqual(bobSnapshot.players.map((player) => player.name), ['Alice']);
  assert.equal((await bobJoined).player.name, 'Bob');

  const spectator = await connect(url, { type: 'spectate', area: 'main_1' });
  t.after(() => spectator.close());
  const spectatorSnapshot = await nextMessage(spectator, (message) => message.type === 'snapshot');
  assert.deepEqual(spectatorSnapshot.players.map((player) => player.name).sort(), ['Alice', 'Bob']);

  const moved = nextMessage(spectator, (message) => message.type === 'player_moved');
  aliceSocket.send(JSON.stringify({ type: 'move', area: 'main_1', x: 128, y: 128, direction: 'RIGHT', moving: true }));
  assert.deepEqual((await moved).player, {
    id: alice.id, name: 'Alice', area: 'main_1', x: 128, y: 128, direction: 'RIGHT', moving: true,
  });
});

test('presence rejects missing origins, malformed payloads, and teleport movement', async (t) => {
  const repository = createMemoryRepository();
  await repository.init();
  const alice = await repository.createCharacter({ wallet: WALLET_A, name: 'Alice', nameKey: 'alice' });
  const app = createApp({ repository, jwtSecret: JWT_SECRET });
  const server = createServer(app);
  const presence = attachPresenceServer({
    server, repository, jwtSecret: JWT_SECRET, allowedOrigins: ['https://playtameria.com'],
  });
  server.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    await presence.close();
    await new Promise((resolve) => server.close(resolve));
  });
  const url = `ws://127.0.0.1:${server.address().port}/ws`;
  const closed = (socket) => new Promise((resolve) => socket.once('close', (code, reason) => resolve({ code, reason: String(reason) })));

  const missingOrigin = new WebSocket(url);
  assert.deepEqual(await closed(missingOrigin), { code: 1008, reason: 'invalid_origin' });

  const malformed = new WebSocket(url, { origin: 'https://playtameria.com' });
  await new Promise((resolve) => malformed.once('open', resolve));
  const malformedClosed = closed(malformed);
  malformed.send('null');
  assert.deepEqual(await malformedClosed, { code: 1008, reason: 'invalid_message' });

  const player = new WebSocket(url, { origin: 'https://playtameria.com' });
  await new Promise((resolve) => player.once('open', resolve));
  player.send(JSON.stringify({
    type: 'join', token: issueToken(WALLET_A, JWT_SECRET), characterId: alice.id,
    area: 'main_1', x: 64, y: 128, direction: 'DOWN',
  }));
  await nextMessage(player, (message) => message.type === 'snapshot');
  const teleportClosed = closed(player);
  player.send(JSON.stringify({ type: 'move', area: 'main_1', x: 640, y: 128, direction: 'RIGHT', moving: true }));
  assert.deepEqual(await teleportClosed, { code: 1008, reason: 'invalid_move' });
});
