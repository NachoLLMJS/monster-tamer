import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { verifyMessage } from 'viem';

const WALLET_PATTERN = /^0x[0-9a-f]{40}$/;
const NONCE_TTL_MS = 10 * 60 * 1000;
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function normalizeWallet(input) {
  const wallet = String(input ?? '').toLowerCase();
  if (!WALLET_PATTERN.test(wallet)) {
    throw Object.assign(new Error('invalid_wallet'), { status: 400 });
  }
  return wallet;
}

function sign(data, secret) {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function issueToken(wallet, secret, now = Date.now()) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ wallet, exp: now + TOKEN_TTL_MS })).toString('base64url');
  const body = `${header}.${payload}`;
  return `${body}.${sign(body, secret)}`;
}

export function verifyToken(token, secret, now = Date.now()) {
  const [header, payload, signature, extra] = String(token ?? '').split('.');
  if (!header || !payload || !signature || extra || !safeEqual(signature, sign(`${header}.${payload}`, secret))) {
    throw Object.assign(new Error('invalid_token'), { status: 401 });
  }
  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw Object.assign(new Error('invalid_token'), { status: 401 });
  }
  if (decoded.exp <= now) {
    throw Object.assign(new Error('expired_token'), { status: 401 });
  }
  return { wallet: normalizeWallet(decoded.wallet), exp: decoded.exp };
}

export function createAuthService({ repository, jwtSecret, authOrigin = 'http://localhost', now = () => Date.now() }) {
  const origin = new URL(authOrigin);
  if (!['http:', 'https:'].includes(origin.protocol)) {
    throw new Error('AUTH_ORIGIN must use http or https');
  }
  const domain = origin.host;
  const uri = origin.origin;
  return {
    async createChallenge(walletInput) {
      const wallet = normalizeWallet(walletInput);
      const nonce = randomBytes(16).toString('hex');
      const issuedAt = new Date(now()).toISOString();
      const expiresAt = new Date(now() + NONCE_TTL_MS).toISOString();
      const message = [
        `${domain} wants you to sign in with your Ethereum account:`,
        wallet,
        '',
        'Sign in to Tameria. This request does not trigger a transaction or cost gas.',
        '',
        `URI: ${uri}`,
        'Version: 1',
        'Chain ID: 4663',
        `Nonce: ${nonce}`,
        `Issued At: ${issuedAt}`,
        `Expiration Time: ${expiresAt}`,
      ].join('\n');
      await repository.putNonce({ nonce, wallet, message, expiresAt });
      return { wallet, nonce, message, expiresAt };
    },

    async verifyChallenge({ wallet: walletInput, nonce, signature }) {
      const wallet = normalizeWallet(walletInput);
      if (!/^[a-f0-9]{32}$/i.test(String(nonce ?? '')) || !/^0x[a-f0-9]{130}$/i.test(String(signature ?? ''))) {
        throw Object.assign(new Error('invalid_auth_payload'), { status: 400 });
      }
      const record = await repository.consumeNonce(String(nonce));
      if (!record || new Date(record.expiresAt).getTime() <= now()) {
        throw Object.assign(new Error('invalid_or_expired_nonce'), { status: 401 });
      }
      if (record.wallet !== wallet) {
        throw Object.assign(new Error('wallet_mismatch'), { status: 401 });
      }
      const valid = await verifyMessage({ address: wallet, message: record.message, signature });
      if (!valid) {
        throw Object.assign(new Error('invalid_signature'), { status: 401 });
      }
      return { wallet, token: issueToken(wallet, jwtSecret, now()), expiresAt: new Date(now() + TOKEN_TTL_MS).toISOString() };
    },
  };
}
