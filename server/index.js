import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { resolveAuthOrigin } from './config.js';
import { createMemoryRepository, createPostgresRepository } from './repository.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isProduction = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? 3000);
const jwtSecret = process.env.JWT_SECRET ?? (isProduction ? '' : 'local-development-secret-change-me-123456');
const authOrigin = resolveAuthOrigin(process.env, isProduction, port);

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('Set JWT_SECRET to a random value with at least 32 characters.');
}
if (isProduction && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required in production. Add a PostgreSQL service in Railway.');
}

const repository = process.env.DATABASE_URL
  ? createPostgresRepository(process.env.DATABASE_URL)
  : createMemoryRepository();

await repository.init();
const app = createApp({
  repository,
  jwtSecret,
  authOrigin,
  staticRoot: root,
  twitterUrl: process.env.TWITTER_URL || 'https://x.com/',
});
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Tameria server ready on http://0.0.0.0:${port}`);
  if (!process.env.DATABASE_URL) {
    console.warn('Using volatile in-memory storage. Set DATABASE_URL for persistent profiles.');
  }
});

async function shutdown(signal) {
  console.log(`${signal} received, shutting down.`);
  server.close(async () => {
    await repository.close();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
