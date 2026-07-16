import pg from 'pg';

const { Pool } = pg;

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function toSummary(character) {
  if (!character) return null;
  const { progress: _progress, ...summary } = character;
  return summary;
}

export function createMemoryRepository() {
  const nonces = new Map();
  const characters = new Map();

  return {
    async init() {},
    async close() {},
    async putNonce(record) {
      nonces.set(record.nonce, clone(record));
    },
    async consumeNonce(nonce) {
      const record = nonces.get(nonce);
      nonces.delete(nonce);
      return clone(record);
    },
    async listCharacters(wallet) {
      return [...characters.values()]
        .filter((character) => character.wallet === wallet)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((character) => clone(toSummary(character)));
    },
    async createCharacter({ wallet, name, nameKey }) {
      if ([...characters.values()].some((character) => character.nameKey === nameKey)) {
        throw Object.assign(new Error('name_taken'), { code: 'NAME_TAKEN' });
      }
      const now = new Date().toISOString();
      const character = {
        id: crypto.randomUUID(),
        wallet,
        name,
        nameKey,
        progress: {},
        progressVersion: 0,
        createdAt: now,
        updatedAt: now,
      };
      characters.set(character.id, character);
      return clone(character);
    },
    async getCharacter(wallet, id) {
      const character = characters.get(id);
      return character?.wallet === wallet ? clone(character) : null;
    },
    async updateCharacterProgress({ wallet, id, progress, expectedVersion }) {
      const character = characters.get(id);
      if (!character || character.wallet !== wallet) return null;
      if (character.progressVersion !== expectedVersion) {
        throw Object.assign(new Error('version_conflict'), { code: 'VERSION_CONFLICT', current: clone(character) });
      }
      character.progress = clone(progress);
      character.progressVersion += 1;
      character.updatedAt = new Date().toISOString();
      return clone(character);
    },
  };
}

export function createPostgresRepository(connectionString) {
  const pool = new Pool({
    connectionString,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
  });

  const toCharacter = (row) => row ? ({
    id: row.id,
    wallet: row.wallet_address,
    name: row.display_name,
    nameKey: row.name_key,
    progress: row.progress ?? {},
    progressVersion: row.progress_version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }) : null;

  return {
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS auth_nonces (
          nonce VARCHAR(64) PRIMARY KEY,
          wallet_address VARCHAR(42) NOT NULL,
          message TEXT NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL
        );
        CREATE INDEX IF NOT EXISTS auth_nonces_expiry_idx ON auth_nonces (expires_at);

        CREATE TABLE IF NOT EXISTS characters (
          id UUID PRIMARY KEY,
          wallet_address VARCHAR(42) NOT NULL,
          display_name VARCHAR(20) NOT NULL,
          name_key VARCHAR(20) NOT NULL UNIQUE,
          progress JSONB NOT NULL DEFAULT '{}'::jsonb,
          progress_version INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS characters_wallet_idx ON characters (wallet_address, updated_at DESC);
      `);
    },
    async close() {
      await pool.end();
    },
    async putNonce(record) {
      await pool.query('DELETE FROM auth_nonces WHERE wallet_address = $1 OR expires_at <= NOW()', [record.wallet]);
      await pool.query(
        `INSERT INTO auth_nonces (nonce, wallet_address, message, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [record.nonce, record.wallet, record.message, record.expiresAt],
      );
    },
    async consumeNonce(nonce) {
      const result = await pool.query(
        `DELETE FROM auth_nonces WHERE nonce = $1
         RETURNING nonce, wallet_address, message, expires_at`,
        [nonce],
      );
      const row = result.rows[0];
      return row ? {
        nonce: row.nonce,
        wallet: row.wallet_address,
        message: row.message,
        expiresAt: row.expires_at.toISOString(),
      } : null;
    },
    async listCharacters(wallet) {
      const result = await pool.query(
        `SELECT id, wallet_address, display_name, name_key, progress_version, created_at, updated_at
         FROM characters WHERE wallet_address = $1 ORDER BY updated_at DESC`,
        [wallet],
      );
      return result.rows.map((row) => toSummary(toCharacter({ ...row, progress: {} })));
    },
    async createCharacter({ wallet, name, nameKey }) {
      try {
        const result = await pool.query(
          `INSERT INTO characters (id, wallet_address, display_name, name_key)
           VALUES (gen_random_uuid(), $1, $2, $3)
           RETURNING *`,
          [wallet, name, nameKey],
        );
        return toCharacter(result.rows[0]);
      } catch (error) {
        if (error.code === '23505') {
          throw Object.assign(new Error('name_taken'), { code: 'NAME_TAKEN' });
        }
        throw error;
      }
    },
    async getCharacter(wallet, id) {
      const result = await pool.query(
        'SELECT * FROM characters WHERE id = $1 AND wallet_address = $2',
        [id, wallet],
      );
      return toCharacter(result.rows[0]);
    },
    async updateCharacterProgress({ wallet, id, progress, expectedVersion }) {
      const result = await pool.query(
        `UPDATE characters
         SET progress = $1::jsonb, progress_version = progress_version + 1, updated_at = NOW()
         WHERE id = $2 AND wallet_address = $3 AND progress_version = $4
         RETURNING *`,
        [JSON.stringify(progress), id, wallet, expectedVersion],
      );
      if (result.rows[0]) return toCharacter(result.rows[0]);
      const current = await this.getCharacter(wallet, id);
      if (!current) return null;
      throw Object.assign(new Error('version_conflict'), { code: 'VERSION_CONFLICT', current });
    },
  };
}
