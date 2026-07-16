import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken } from './auth.js';

const MAP_BOUNDS = Object.freeze({
  main_1: { width: 2560, height: 5568 },
  forest_1: { width: 1280, height: 768 },
  plaza_1: { width: 1536, height: 1024 },
  building_1: { width: 832, height: 576 },
  building_2: { width: 832, height: 576 },
  building_3: { width: 832, height: 576 },
});
const TILE_SIZE = 64;
const DIRECTIONS = new Set(['UP', 'DOWN', 'LEFT', 'RIGHT']);
const MAX_CONNECTIONS_PER_IP = 20;
const JOIN_TIMEOUT_MS = 10_000;
const HEARTBEAT_MS = 30_000;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function hasExactKeys(value, keys) {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
}

function validArea(area) {
  return typeof area === 'string' && Object.hasOwn(MAP_BOUNDS, area);
}

function validPosition(area, x, y) {
  const bounds = MAP_BOUNDS[area];
  return Boolean(
    bounds && Number.isInteger(x) && Number.isInteger(y) &&
    x >= 0 && y >= 0 && x < bounds.width && y < bounds.height &&
    x % TILE_SIZE === 0 && y % TILE_SIZE === 0
  );
}

function validStep(previous, message) {
  if (message.area !== previous.area || !validPosition(message.area, message.x, message.y)) return false;
  const dx = message.x - previous.x;
  const dy = message.y - previous.y;
  if (!message.moving) return dx === 0 && dy === 0 && DIRECTIONS.has(message.direction);
  const expected = {
    UP: [0, -TILE_SIZE], DOWN: [0, TILE_SIZE], LEFT: [-TILE_SIZE, 0], RIGHT: [TILE_SIZE, 0],
  }[message.direction];
  return Boolean(expected && dx === expected[0] && dy === expected[1]);
}

function send(socket, message) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

export function attachPresenceServer({ server, repository, jwtSecret, allowedOrigins = [] }) {
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
  const clients = new Set();
  const trustedOrigins = new Set(allowedOrigins);
  const connectionsByIp = new Map();

  function playersInArea(area, except) {
    return [...clients]
      .filter((client) => client !== except && client.player?.area === area)
      .map((client) => client.player);
  }

  function broadcast(area, message, except) {
    for (const client of clients) {
      if (client !== except && client.area === area) send(client.socket, message);
    }
  }

  function leaveRoom(client) {
    if (client.player) broadcast(client.player.area, { type: 'player_left', playerId: client.player.id }, client);
    client.player = null;
    client.area = null;
  }

  function closeClient(client, code, reason) {
    if (client.socket.readyState === WebSocket.OPEN || client.socket.readyState === WebSocket.CONNECTING) {
      client.socket.close(code, reason);
    }
  }

  async function handleMessage(client, raw) {
    const { socket } = client;
    const now = Date.now();
    if (now >= client.resetAt) {
      client.messageCount = 0;
      client.resetAt = now + 1_000;
    }
    client.messageCount += 1;
    if (client.messageCount > 40) return closeClient(client, 1008, 'rate_limited');

    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return closeClient(client, 1003, 'invalid_json');
    }
    if (!isPlainObject(message) || typeof message.type !== 'string') {
      return closeClient(client, 1008, 'invalid_message');
    }

    if (message.type === 'spectate') {
      if (!hasExactKeys(message, ['type', 'area']) || !validArea(message.area)) {
        return closeClient(client, 1008, 'invalid_spectate');
      }
      clearTimeout(client.joinTimer);
      leaveRoom(client);
      client.area = message.area;
      send(socket, { type: 'snapshot', players: playersInArea(client.area, client) });
      return;
    }

    if (message.type === 'join') {
      if (
        !hasExactKeys(message, ['type', 'token', 'characterId', 'area', 'x', 'y', 'direction']) ||
        typeof message.token !== 'string' || typeof message.characterId !== 'string' ||
        !validArea(message.area) || !validPosition(message.area, message.x, message.y) ||
        !DIRECTIONS.has(message.direction)
      ) {
        return closeClient(client, 1008, 'invalid_join');
      }
      const auth = verifyToken(message.token, jwtSecret);
      const character = await repository.getCharacter(auth.wallet, message.characterId);
      if (socket.readyState !== WebSocket.OPEN || !clients.has(client)) return;
      if (!character) return closeClient(client, 1008, 'character_not_found');

      for (const other of clients) {
        if (other !== client && other.player?.id === character.id) {
          leaveRoom(other);
          closeClient(other, 1008, 'session_replaced');
        }
      }
      clearTimeout(client.joinTimer);
      leaveRoom(client);
      client.player = {
        id: character.id, name: character.name, area: message.area,
        x: message.x, y: message.y, direction: message.direction, moving: false,
      };
      client.area = message.area;
      send(socket, { type: 'snapshot', players: playersInArea(client.area, client) });
      broadcast(client.area, { type: 'player_joined', player: client.player }, client);
      return;
    }

    if (message.type === 'move') {
      if (
        !client.player ||
        !hasExactKeys(message, ['type', 'area', 'x', 'y', 'direction', 'moving']) ||
        typeof message.moving !== 'boolean' || !validStep(client.player, message)
      ) {
        return closeClient(client, 1008, 'invalid_move');
      }
      Object.assign(client.player, {
        x: message.x, y: message.y, direction: message.direction, moving: message.moving,
      });
      broadcast(client.area, { type: 'player_moved', player: client.player }, client);
      return;
    }

    closeClient(client, 1008, 'unsupported_message');
  }

  wss.on('connection', (socket, request) => {
    const origin = request.headers.origin;
    if (trustedOrigins.size > 0 && (typeof origin !== 'string' || !trustedOrigins.has(origin))) {
      socket.close(1008, 'invalid_origin');
      return;
    }
    const ip = request.socket.remoteAddress ?? 'unknown';
    const connectionCount = connectionsByIp.get(ip) ?? 0;
    if (connectionCount >= MAX_CONNECTIONS_PER_IP) {
      socket.close(1013, 'connection_limit');
      return;
    }
    connectionsByIp.set(ip, connectionCount + 1);
    const client = {
      socket, ip, area: null, player: null, messageCount: 0,
      resetAt: Date.now() + 1_000, isAlive: true, closed: false,
      joinTimer: setTimeout(() => socket.close(1008, 'join_timeout'), JOIN_TIMEOUT_MS),
    };
    clients.add(client);
    socket.on('pong', () => { client.isAlive = true; });
    socket.on('message', (raw) => {
      void handleMessage(client, raw).catch(() => closeClient(client, 1008, 'invalid_session'));
    });
    socket.on('close', () => {
      if (client.closed) return;
      client.closed = true;
      clearTimeout(client.joinTimer);
      leaveRoom(client);
      clients.delete(client);
      const remaining = (connectionsByIp.get(ip) ?? 1) - 1;
      if (remaining > 0) connectionsByIp.set(ip, remaining);
      else connectionsByIp.delete(ip);
    });
  });

  const heartbeat = setInterval(() => {
    for (const client of clients) {
      if (!client.isAlive) {
        client.socket.terminate();
        continue;
      }
      client.isAlive = false;
      client.socket.ping();
    }
  }, HEARTBEAT_MS);
  heartbeat.unref?.();

  return {
    async close() {
      clearInterval(heartbeat);
      for (const client of clients) client.socket.terminate();
      await new Promise((resolve) => wss.close(resolve));
    },
  };
}
