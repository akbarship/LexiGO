LexiGO
======

LexiGO is now a JavaScript Telegram vocabulary product:

- Telegram bot: `grammY`
- HTTP API and mini web app: `Fastify`
- Database: `MongoDB` via `mongoose`
- Dictionary generation: OpenAI
- Memorization: short SRS sessions in the web app

Core Flow
---------

1. User sends an English word to the bot.
2. Bot returns a learner-friendly definition, Uzbek meaning, example, IPA, CEFR level, and synonyms.
3. User taps `Save word`.
4. Bot asks which personal collection/group to save into.
5. User practices saved words inside the Telegram web app.
6. The web app runs short SRS sessions, gives XP, updates streaks, and tracks mastery per collection.

Run Locally
-----------

```bash
npm install
cp .env.example .env
npm run dev
```

Required `.env` values:

```bash
BOT_TOKEN=
OPENAI_API_KEY=
MONGODB_URI=mongodb://127.0.0.1:27017/lexigo
WEBAPP_URL=https://your-domain-or-tunnel.example
PORT=3000
```

Local mini app testing:

```text
http://localhost:3000?telegramId=7853044770
```

The `telegramId` query is accepted only for localhost-style development.
For tunnel-based local testing outside Telegram, set `ALLOW_DEV_AUTH=true`.

Telegram WebApp Notes
---------------------

Telegram WebApp buttons require an HTTPS `WEBAPP_URL`. For local bot testing, expose Fastify with an HTTPS tunnel such as ngrok or Cloudflare Tunnel, then put that HTTPS URL in `.env`.

Important Files
---------------

- `src/index.js` starts MongoDB, Fastify, and the grammY bot.
- `src/bot/index.js` handles Telegram lookup/save/group flows.
- `src/api/routes.js` exposes the mini app API.
- `src/services/srs.js` contains the SRS scheduling and XP logic.
- `src/models/*` contains MongoDB schemas.
- `public/*` is the Telegram mini app UI.

Legacy Python Files
-------------------

The old Python/SQLite implementation is still in the repository as reference, including `lexigo.db`. The new active app is the JavaScript stack above.
