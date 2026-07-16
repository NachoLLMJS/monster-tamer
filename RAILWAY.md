# Tameria on Railway

## Current architecture

- `PLAY` opens a wallet-authenticated character hub.
- One wallet can own multiple characters.
- Every character has a globally unique display name and independent progress.
- Existing characters are listed after the wallet signs in; selecting one loads its progress from PostgreSQL.
- New characters and all saves go directly to Railway/PostgreSQL. Game progress is not stored in `localStorage` or `sessionStorage`.
- The selected character name is rendered above the local Phaser player. The reusable `CharacterNameplate` class is also the component intended for future remote multiplayer players.
- `SPECTATOR MODE` remains wallet-free and does not persist progress.

Wallet login is a gas-free signature. It does not mint anything and does not send a transaction.

## Robinhood Chain Mainnet

- Chain ID: `4663` (`0x1237`)
- Native token: `ETH`
- Public RPC: `https://rpc.mainnet.chain.robinhood.com`
- Explorer: `https://robinhoodchain.blockscout.com`
- Official docs: `https://docs.robinhood.com/chain/connecting/`

The official public RPC is rate-limited. Use an authenticated RPC before adding frequent contract reads or writes.

## Railway variables

Railway's PostgreSQL service normally creates variables such as `DATABASE_URL`, `DATABASE_PUBLIC_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, and `PGDATABASE`. Those are expected. Do not copy every PostgreSQL variable to the game service.

In the **monster-tamer service**, add only:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
NODE_ENV=production
JWT_SECRET=<long-random-secret>
TWITTER_URL=<your-real-X-profile-url>
```

Railway automatically provides `RAILWAY_PUBLIC_DOMAIN`; Tameria uses it to bind wallet signatures to the production domain. If you later use a custom domain, set `AUTH_ORIGIN=https://your-domain.example` explicitly.

Generate `JWT_SECRET` locally:

```bash
openssl rand -base64 48
```

Do not add `PORT`; Railway supplies it.

`DATABASE_URL` is the private internal connection between the game service and PostgreSQL. `DATABASE_PUBLIC_URL` is only needed for connecting from a computer outside Railway.

## Rotate the exposed database credentials first

A screenshot shared during setup showed the database password and complete connection URLs. Because the database currently has no tables or player data, the safest and simplest rotation is:

1. Delete the current empty PostgreSQL service in Railway.
2. Add a new PostgreSQL service.
3. Never reveal or screenshot its unmasked variable values.
4. Recreate the `DATABASE_URL=${{Postgres.DATABASE_URL}}` reference in the monster-tamer service.

Do not paste the new password or connection URL into chat, source files, GitHub, or Obsidian.

## First deployment steps

1. Rotate/recreate the empty PostgreSQL service as described above.
2. In the monster-tamer Railway service, add the four variables shown above.
3. Set `TWITTER_URL` to the project account you want the permanent lower-right button to open.
4. Push this updated project to the GitHub repository only when ready.
5. Railway will run `npm start` using `railway.json`.
6. Generate or keep the public HTTPS domain for the monster-tamer service.
7. Open `/api/health`; it must return `{"ok":true}`.
8. On first startup the backend automatically creates:
   - `auth_nonces`
   - `characters`
9. In Railway's PostgreSQL Data tab, refresh and confirm both tables appear.
10. Test with a real wallet:
    - Open `PLAY`.
    - Connect on Robinhood Chain Mainnet.
    - Sign the login message.
    - Create two differently named characters.
    - Reload and reconnect.
    - Confirm both appear under `YOUR CHARACTERS`.
    - Enter one, save, reload, and confirm only that character resumes from its saved progress.

## API

- `POST /api/auth/nonce`
- `POST /api/auth/verify`
- `GET /api/characters`
- `POST /api/characters`
- `GET /api/characters/:id`
- `PUT /api/characters/:id/progress`
- `GET /api/config`
- `GET /api/health`

All character routes require a verified wallet bearer token. Character lookups are additionally scoped to the authenticated wallet.

## Multiplayer next step

Do not store movement on Robinhood Chain. Use:

- Robinhood wallet: identity and optional onchain ownership.
- PostgreSQL: characters and durable progress.
- Authoritative WebSocket server: real-time movement and interactions.
- Redis Pub/Sub: room synchronization when Railway runs multiple server instances.

Implementation order:

1. Add an authenticated WebSocket endpoint.
2. Create one authoritative room per map.
3. Send movement intent from the client and validate it server-side.
4. Instantiate remote Phaser players and attach `CharacterNameplate` to every remote sprite.
5. Add interpolation, heartbeat, reconnect, and rate limiting.
6. Persist only durable state snapshots to PostgreSQL.
7. Add Redis before scaling beyond one game-server instance.

The current code prepares wallet sessions, multiple wallet-owned characters, remote progress, and a reusable local/remote nameplate. WebSocket rooms and remote player rendering are not live yet.
