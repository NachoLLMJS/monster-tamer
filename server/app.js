import path from 'node:path';
import express from 'express';
import { createAuthService, verifyToken } from './auth.js';
import { normalizePlayerName } from '../src/profile/profile-utils.js';

function createRateLimiter({ windowMs, max }) {
  const buckets = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    bucket.count += 1;
    if (bucket.count > max) {
      res.status(429).json({ error: 'too_many_requests' });
      return;
    }
    next();
  };
}

function publicCharacter(character) {
  if (!character) return null;
  const { wallet: _wallet, nameKey: _nameKey, ...safeCharacter } = character;
  return safeCharacter;
}

function createAuthMiddleware(jwtSecret) {
  return (req, res, next) => {
    const header = req.get('authorization') ?? '';
    if (!header.startsWith('Bearer ')) {
      res.status(401).json({ error: 'authentication_required' });
      return;
    }
    try {
      req.auth = verifyToken(header.slice(7), jwtSecret);
      next();
    } catch {
      res.status(401).json({ error: 'invalid_session' });
    }
  };
}

export function createApp({ repository, jwtSecret, authOrigin = 'http://localhost', staticRoot, twitterUrl = 'https://x.com/' }) {
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters');
  }
  const app = express();
  const authService = createAuthService({ repository, jwtSecret, authOrigin });
  const requireAuth = createAuthMiddleware(jwtSecret);
  const authLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((req, res, next) => {
    if (req.path === '/' || req.path === '/index.html' || req.path.startsWith('/src/') || req.path.startsWith('/api/')) {
      res.set('Cache-Control', 'no-store');
    }
    res.set({
      'Content-Security-Policy': [
        "default-src 'self'",
        "img-src 'self' data: blob:",
        "style-src 'self' 'unsafe-inline'",
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
        "font-src 'self' data:",
        "connect-src 'self' https://rpc.mainnet.chain.robinhood.com",
        "media-src 'self' data: blob:",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "frame-src 'none'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "form-action 'self'",
      ].join('; '),
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    });
    next();
  });
  app.use(express.json({ limit: '512kb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/config', (_req, res) => res.json({ twitterUrl }));

  app.post('/api/auth/nonce', authLimiter, async (req, res, next) => {
    try {
      res.json(await authService.createChallenge(req.body?.wallet));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/verify', authLimiter, async (req, res, next) => {
    try {
      res.json(await authService.verifyChallenge(req.body ?? {}));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/characters', requireAuth, async (req, res, next) => {
    try {
      const characters = await repository.listCharacters(req.auth.wallet);
      res.json({ characters: characters.map(publicCharacter) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/characters', requireAuth, async (req, res, next) => {
    try {
      const name = normalizePlayerName(req.body?.name);
      const character = await repository.createCharacter({
        wallet: req.auth.wallet,
        name,
        nameKey: name.toLocaleLowerCase('en-US'),
      });
      res.status(201).json(publicCharacter(character));
    } catch (error) {
      if (error.code === 'NAME_TAKEN') {
        res.status(409).json({ error: 'name_taken' });
        return;
      }
      next(error);
    }
  });

  app.get('/api/characters/:id', requireAuth, async (req, res, next) => {
    try {
      const character = await repository.getCharacter(req.auth.wallet, req.params.id);
      if (!character) {
        res.status(404).json({ error: 'character_not_found' });
        return;
      }
      res.json(publicCharacter(character));
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/characters/:id/progress', requireAuth, async (req, res, next) => {
    try {
      const progress = req.body?.progress;
      const version = Number(req.body?.version);
      if (!progress || typeof progress !== 'object' || Array.isArray(progress) || !Number.isInteger(version) || version < 0) {
        res.status(400).json({ error: 'invalid_progress' });
        return;
      }
      if (Buffer.byteLength(JSON.stringify(progress), 'utf8') > 450_000) {
        res.status(413).json({ error: 'progress_too_large' });
        return;
      }
      const character = await repository.updateCharacterProgress({
        wallet: req.auth.wallet,
        id: req.params.id,
        progress,
        expectedVersion: version,
      });
      if (!character) {
        res.status(404).json({ error: 'character_not_found' });
        return;
      }
      res.json(publicCharacter(character));
    } catch (error) {
      if (error.code === 'VERSION_CONFLICT') {
        res.status(409).json({ error: 'version_conflict', current: publicCharacter(error.current) });
        return;
      }
      next(error);
    }
  });

  if (staticRoot) {
    app.use('/assets', express.static(path.join(staticRoot, 'assets'), { maxAge: 0 }));
    app.use('/src', express.static(path.join(staticRoot, 'src'), { maxAge: 0 }));
    app.get(['/', '/index.html'], (_req, res) => res.sendFile(path.join(staticRoot, 'index.html')));
  }

  app.use((error, _req, res, _next) => {
    const status = Number(error.status) || 500;
    if (status >= 500) console.error(error);
    res.status(status).json({ error: status >= 500 ? 'internal_error' : error.message });
  });

  return app;
}
