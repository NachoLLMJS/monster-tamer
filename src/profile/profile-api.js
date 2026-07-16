import { connectRobinhoodWallet, getEthereumProvider, normalizePlayerName } from './profile-utils.js?v=characters-v1';

async function apiRequest(path, { token, ...options } = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error ?? 'request_failed');
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

export async function authenticateWallet() {
  const provider = getEthereumProvider();
  if (!provider) {
    throw new Error('No EVM wallet detected. Install MetaMask or Robinhood Wallet.');
  }
  const wallet = await connectRobinhoodWallet(provider);
  const challenge = await apiRequest('/api/auth/nonce', {
    method: 'POST',
    body: JSON.stringify({ wallet }),
  });
  const signature = await provider.request({
    method: 'personal_sign',
    params: [challenge.message, wallet],
  });
  const auth = await apiRequest('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ wallet, nonce: challenge.nonce, signature }),
  });
  const session = { wallet, token: auth.token, character: null };
  return session;
}

export async function listPlayerCharacters(session) {
  const response = await apiRequest('/api/characters', { token: session.token });
  return response.characters;
}

export async function createPlayerCharacter(session, nameInput) {
  const name = normalizePlayerName(nameInput);
  return apiRequest('/api/characters', {
    token: session.token,
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function loadPlayerCharacter(session, characterId) {
  return apiRequest(`/api/characters/${encodeURIComponent(characterId)}`, { token: session.token });
}

export async function saveRemoteProgress(session, progress, version) {
  if (!session.character?.id) throw new Error('character_required');
  return apiRequest(`/api/characters/${encodeURIComponent(session.character.id)}/progress`, {
    token: session.token,
    method: 'PUT',
    keepalive: true,
    body: JSON.stringify({ progress, version }),
  });
}
