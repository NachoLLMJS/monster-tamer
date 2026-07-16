const TRANSIENT_CLOSE_CODES = new Set([1001, 1006, 1012, 1013]);

function validPlayer(player) {
  return Boolean(
    player && typeof player === 'object' &&
    typeof player.id === 'string' && typeof player.name === 'string' &&
    typeof player.area === 'string' && Number.isFinite(player.x) && Number.isFinite(player.y) &&
    typeof player.direction === 'string' && typeof player.moving === 'boolean'
  );
}

function validServerMessage(message) {
  if (!message || typeof message !== 'object' || typeof message.type !== 'string') return false;
  if (message.type === 'snapshot') return Array.isArray(message.players) && message.players.every(validPlayer);
  if (message.type === 'player_joined' || message.type === 'player_moved') return validPlayer(message.player);
  if (message.type === 'player_left') return typeof message.playerId === 'string';
  return false;
}

export class PresenceClient {
  #socket;
  #WebSocketImpl;
  #url;
  #session;
  #area;
  #position;
  #direction;
  #spectator;
  #onMessage;
  #setTimer;
  #clearTimer;
  #retryTimer;
  #retryDelay = 500;
  #destroyed = false;

  constructor({
    WebSocketImpl = WebSocket, url, session, area, position, direction,
    spectator = false, onMessage, setTimer = setTimeout, clearTimer = clearTimeout,
  }) {
    this.#WebSocketImpl = WebSocketImpl;
    this.#url = url ?? `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
    this.#session = session;
    this.#area = area;
    this.#position = position ? { ...position } : undefined;
    this.#direction = direction;
    this.#spectator = spectator;
    this.#onMessage = onMessage;
    this.#setTimer = setTimer;
    this.#clearTimer = clearTimer;
    this.#connect();
  }

  #connect() {
    if (this.#destroyed) return;
    const socket = new this.#WebSocketImpl(this.#url);
    this.#socket = socket;
    socket.addEventListener('open', () => {
      if (this.#destroyed || socket !== this.#socket) return;
      this.#retryDelay = 500;
      if (this.#spectator) {
        this.#send({ type: 'spectate', area: this.#area });
        return;
      }
      this.#send({
        type: 'join', token: this.#session.token, characterId: this.#session.character.id,
        area: this.#area, x: this.#position.x, y: this.#position.y, direction: this.#direction,
      });
    });
    socket.addEventListener('message', (event) => {
      if (this.#destroyed || socket !== this.#socket) return;
      try {
        const message = JSON.parse(event.data);
        if (!validServerMessage(message)) throw new Error('Invalid server presence payload.');
        this.#onMessage(message);
      } catch (error) {
        console.warn('Ignored invalid multiplayer message.', error);
      }
    });
    socket.addEventListener('close', (event) => {
      if (this.#destroyed || socket !== this.#socket || !TRANSIENT_CLOSE_CODES.has(event.code)) return;
      this.#retryTimer = this.#setTimer(() => {
        this.#retryTimer = undefined;
        this.#connect();
      }, this.#retryDelay);
      this.#retryDelay = Math.min(this.#retryDelay * 2, 10_000);
    });
  }

  sendMovement({ x, y, direction, moving }) {
    this.#position = { x, y };
    this.#direction = direction;
    this.#send({ type: 'move', area: this.#area, x, y, direction, moving });
  }

  #send(message) {
    if (this.#socket?.readyState === 1) this.#socket.send(JSON.stringify(message));
  }

  destroy() {
    this.#destroyed = true;
    if (this.#retryTimer !== undefined) this.#clearTimer(this.#retryTimer);
    this.#socket?.close();
  }
}
