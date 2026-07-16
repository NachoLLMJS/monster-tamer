import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PresenceClient } from '../src/multiplayer/presence-client.js';

class FakeSocket {
  static OPEN = 1;
  readyState = 0;
  sent = [];
  listeners = new Map();
  constructor(url) { this.url = url; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  send(value) { this.sent.push(JSON.parse(value)); }
  close() { this.readyState = 3; }
  remoteClose(code) { this.readyState = 3; this.listeners.get('close')?.({ code }); }
  open() { this.readyState = 1; this.listeners.get('open')?.(); }
  message(value) { this.listeners.get('message')?.({ data: JSON.stringify(value) }); }
}

test('presence client authenticates players and forwards remote presence events', () => {
  let socket;
  const events = [];
  const client = new PresenceClient({
    WebSocketImpl: class extends FakeSocket { constructor(url) { super(url); socket = this; } },
    url: 'wss://game.example/ws',
    session: { token: 'token', character: { id: 'hero' } },
    area: 'main_1', position: { x: 64, y: 128 }, direction: 'DOWN',
    onMessage: (message) => events.push(message),
  });
  socket.open();
  assert.deepEqual(socket.sent[0], {
    type: 'join', token: 'token', characterId: 'hero', area: 'main_1', x: 64, y: 128, direction: 'DOWN',
  });
  client.sendMovement({ x: 128, y: 128, direction: 'RIGHT', moving: true });
  assert.deepEqual(socket.sent[1], { type: 'move', area: 'main_1', x: 128, y: 128, direction: 'RIGHT', moving: true });
  socket.message({
    type: 'player_joined',
    player: { id: 'friend', name: 'Friend', area: 'main_1', x: 192, y: 128, direction: 'LEFT', moving: false },
  });
  assert.equal(events[0].player.id, 'friend');
  client.destroy();
  assert.equal(socket.readyState, 3);
});

test('spectators join a map without publishing a character', () => {
  let socket;
  new PresenceClient({
    WebSocketImpl: class extends FakeSocket { constructor(url) { super(url); socket = this; } },
    url: 'wss://game.example/ws', area: 'plaza_1', spectator: true, onMessage() {},
  });
  socket.open();
  assert.deepEqual(socket.sent, [{ type: 'spectate', area: 'plaza_1' }]);
});

test('transient disconnect reconnects with the latest player position', () => {
  const sockets = [];
  let retry;
  const client = new PresenceClient({
    WebSocketImpl: class extends FakeSocket { constructor(url) { super(url); sockets.push(this); } },
    url: 'wss://game.example/ws',
    session: { token: 'token', character: { id: 'hero' } },
    area: 'main_1', position: { x: 64, y: 128 }, direction: 'DOWN', onMessage() {},
    setTimer: (callback) => { retry = callback; return 1; }, clearTimer() {},
  });
  sockets[0].open();
  sockets[0].remoteClose(1006);
  client.sendMovement({ x: 128, y: 128, direction: 'RIGHT', moving: false });
  retry();
  sockets[1].open();
  assert.deepEqual(sockets[1].sent[0], {
    type: 'join', token: 'token', characterId: 'hero', area: 'main_1', x: 128, y: 128, direction: 'RIGHT',
  });
  client.destroy();
});
