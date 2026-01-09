# Developer README — Zenith Discord Bot

This document describes the project layout, each module/file purpose, and how components work together. Use this as a quick reference when modifying, adding commands, or debugging.

---

## Repository structure (top-level)
- `package.json` — project manifest and dependencies.
- `README.md` — general project README (user-facing).
- `DEVELOPER_README.md` — this file (developer documentation).
- `config.json` — runtime configuration (clientId, devs, prefixes). Loaded by runtime code.
- `.env` — environment secrets (Discord token, API keys). Not committed.
- `fnf-keys.json` — persisted FNF user entries (array of `{name,key}` objects).

## src/
All runtime code lives under `src/`.

### Entry & bootstrap
- `src/index.js` — bot entrypoint. Initializes the Discord client, connects to MongoDB (if configured), sets up the event handler loader (`src/handlers/eventHandler.js`) and starts the bot. If you need the monitor auto-started, call `require('./utils/priceMonitor').start()` here (or in a ready handler).

### Handlers
- `src/handlers/eventHandler.js` — scans `src/events/**` directories and registers each folder as an event emitter name (e.g., `messageCreate`, `ready`). For each event it loads all files in that folder and calls them in order. Event files must export a function `(client, ...args) => {}`.

### Events
Events are organized by Discord event name under `src/events/`.

- `src/events/ready/01registerCommands.js` — registers application (slash) commands with Discord on startup. Keeps commands in sync between local files and the application.
- `src/events/ready/consoleLog.js` — simple ready handler that logs startup info to console.
- `src/events/interactionCreate/handleCommands.js` — central dispatcher for slash commands (loads command modules from `src/commands/**` and executes the callback). Implements permissions checks and error handling.
- `src/events/messageCreate/prefixCommands.js` — lightweight prefix command bridge. Reads `config.json.prefixes` (defaults to `['z!','!']`) and supports a limited set of prefix commands by creating a mock interaction object and delegating to the corresponding slash command module (e.g., `fnfPush`).
- `src/events/messageCreate/logMessages.js` — logs messages to local DB/model for recap usage. (Used by recap/recap logger utilities.)

### Commands
Commands are split into subfolders. Each command module exports an object with at least: `name`, `description`, `options` and a `callback(client, interaction)` to run.

Subfolders and important commands:

- `src/commands/pushover/`
  - `alert.js` — low-level pushover alert dispatch command (generic alert).
  - `alertUser.js` — send single-user pushover alerts.
  - `configure.js` — configure Pushover settings in DB (stores `PushoverConfig`).
  - `degenAlert.js` — convenience command for a specific alert flow.
  - `fnfPush.js` — sends FNF alerts to all keys in `fnf-keys.json` (individual messages per user). Supports reading new merged `{name,key}` JSON format while keeping backwards compatibility with an array of strings.
  - `fnfJoin.js` — slash command to register a user's Pushover key into `fnf-keys.json` (restricted to FNF server ID `1411252468058427425`).
  - `fnfList.js` — lists registered FNF names (ephemeral reply).
  - `setKey.js` / `setRole.js` — helper commands for configuring Pushover per-guild options.

- `src/commands/monitor/` (price monitor)
  - `priceAddAlert.js` — `/price-add-alert` to add an alert (token identifier, target USD, webhook, optional name).
  - `priceRemoveAlert.js` — `/price-remove-alert` to remove by id.
  - `priceListAlerts.js` — `/price-list-alerts` lists active alerts (id & name).
  - `priceMonitorControl.js` — `/price-monitor` start/stop/status for the monitoring loop.

- `src/commands/misc/`
  - `ping.js` — health/ping command.
  - `react.js` — convenience helper to add reactions.
  - `recapStart.js`, `recapStop.js`, `recapLogging.js`, `testRecap.js` — commands related to the AI recap workflow and logging.
  - `logging.js`, `logStorage.js`, `forwardLogs.js`, `exportRecaps.js` — log and recap management utilities.

- `src/commands/moderation/ban.js` — ban command (moderation helper).

- `src/commands/reputation/` — reputation commands were neutralized/disabled: `reputation.js`, `giveRep.js`, `repLeader.js`. The model `src/models/Reputation.js` was replaced with a safe stub to avoid runtime errors. If you want full deletion, remove files and command registration.

### Utils
Reusable tooling and helpers live in `src/utils/`.

- `src/utils/getAllFiles.js` — recursive file enumerator used by the event/command loaders.
- `src/utils/getLocalCommands.js` — gathers local command definitions for registration.
- `src/utils/getApplicationCommands.js` — fetches application (registered) commands from Discord for comparison.
- `src/utils/areCommandsDifferent.js` — compares local and remote command definitions to determine changes.
- `src/utils/loggingState.js` — helper that tracks per-guild logging state.
- `src/utils/recapLogger.js` — collects messages for recap generation (writes to `exports/` and local store as needed).
- `src/utils/gemini.js` — wrapper/helper for calls to Google/Gemini/OpenAI style APIs (project-specific). Used by recap flows.
- `src/utils/geminiRecap.js` — orchestrates AI recap generation: formats messages, calls external AI provider (DeepSeek/Gemini), and has robust retry/fallback logic. Builds a safe fallback recap if AI fails.
- `src/utils/priceMonitor.js` — multi-chain price monitoring utility (uses Birdeye multi_price endpoint). Features:
  - In-memory alert store with persistence to `fnf-monitor-alerts.json`.
  - Polls Birdeye every 10 seconds.
  - Groups addresses by detected chain (heuristic: `0x` → `ethereum`, base58-ish → `solana`, fallback → `solana`).
  - Makes one multi_price call per chain (includes the required `x-chain` header), merges results, triggers webhook notifications and removes alerts when targets are reached.
  - Methods: `addAlert()`, `removeAlert()`, `listAlerts()`, `start()`, `stop()`, `status()`.
  - Rate limit tracking to avoid exceeding ~60 calls/min (local sliding window).

Other small scripts in `src/utils/scripts/`:
- `deleteAllCommands.js` — script to remove all registered application commands (use with caution).
- `deleteOldCommands.js` — utility to clean up older commands.
- `migratePushoverConfig.js` — migration script for old pushover config formats.
- `resetSobDatabase.js` — one-off reset script.

### Models
- `src/models/PushoverConfig.js` — Mongoose model storing Pushover configuration per guild: API key, role IDs, alert settings, etc.
- `src/models/LoggedMessage.js` — message log model used for recap generation and analytics.
- `src/models/Reputation.js` — stub model (reputation system removed). Left as stub to avoid runtime errors if modules still `require()` it.

### Root utilities
- `fnf-keys.json` — persisted FNF user list. Now uses `{name,key}` entries. `fnfJoin` appends new entries.

## How the main flows work

1. Command registration
   - On `ready`, `01registerCommands.js` loads local commands from `src/commands/**` and compares them to Discord's registered commands. It updates the application commands when there are changes.

2. Slash command handling
   - `interactionCreate` events are routed by `handleCommands.js`, which locates the matching module by name and calls its `callback(client, interaction)`.

3. Prefix commands
   - `prefixCommands.js` supports a small set of text commands (configured via `config.json.prefixes`) by constructing a `mockInteraction` object and calling the matching command module — this keeps most logic in a single command implementation (slash-based) while allowing text-based compatibility.

4. Price monitoring
   - Alerts are added with `/price-add-alert` and stored in memory and persisted to `fnf-monitor-alerts.json`.
   - Start the monitor with `/price-monitor action:start`. The monitor polls the Birdeye endpoint every 10 seconds and fetches prices per chain using `x-chain` headers. When a monitored token reaches or exceeds a target price, the monitor sends an embed to the provided webhook and removes the alert.

5. FNF push workflow
   - Use `/fnf-join` to register a Pushover key for your user (restricted to a configured guild). `/fnf-push` sends the message to all registered keys using the Pushover API, with per-user success/failure reporting.

6. Recaps
   - `recapLogger.js` collects messages and `geminiRecap.js` generates recaps via external AI. If the AI calls fail, the module gracefully falls back to a safe textual summary.

## Environment variables
- `DISCORD_TOKEN` — bot token (required for running). Keep secret.
- `MONGODB_URI` — MongoDB connection string (optional; used for LoggedMessage and PushoverConfig persistence).
- `BIRDEYE_API_KEY` — Birdeye API key (optional; API is public but header can be provided).
- `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL` — AI provider keys/settings used by recaps.
- `GOOGLE_API_KEY` — optional Google Translate API key used by legacy translation features.

## Development notes & recommendations
- Auto-start monitor: if you want automatic monitoring on bot boot, call `require('./utils/priceMonitor').start()` in `src/index.js` or in a `ready` handler. Be mindful of API usage.
- Command registration: when updating commands, incrementally test in a dev server and use `01registerCommands.js` workflow.
- Testing: Add unit tests for `priceMonitor` (mock axios) to validate per-chain batching and webhook send flow.
- Security: never commit secret keys to the repo. `.env` is already in `.gitignore` but review history if secrets were committed previously.
- Persistence: `fnf-keys.json` and `fnf-monitor-alerts.json` are persisted JSON files at repo root. For larger scale, consider migrating to a DB.

## Quick reference (file map)
See the top of this file for a high-level list. For each file not covered above, the purpose is:

- `src/utils/sendAlert.js` — helper to send alerts (used by multiple alerting commands).
- `src/utils/loggingState.js` — track per-guild logging toggle/state used by recap and message logging commands.

If you want, I can expand this file to include function-level documentation, example API responses (Birdeye), and sample webhook payloads.

---

If you'd like a generated markdown table of every file with one-line descriptions, or function-level docs for specific modules, tell me which level of detail you prefer and I'll update this file.
