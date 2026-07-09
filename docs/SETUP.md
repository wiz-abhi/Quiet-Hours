# Setup

A precise, numbered setup for a solo developer on Windows. You need **Node ≥ 20**. Anthropic and PagerDuty are optional — Quiet Hours ships mock fallbacks so the full flow runs without either. Steps that are optional are marked **(optional)**.

---

## a. Create a Slack developer sandbox and app

1. Get a **Slack developer sandbox** (a free workspace for building) from the Slack developer program, and sign in to it.
2. Go to <https://api.slack.com/apps> → **Create New App** → **From an app manifest**. Pick your sandbox workspace, then paste the contents of `manifest.json` from this repo. This provisions the app with the scopes, event subscriptions, and the `/quiethours` slash command in one shot.
3. Confirm the app requests these **Bot Token Scopes**:
   - `channels:history` — read messages in watched public channels
   - `channels:read` — list/inspect channels
   - `chat:write` — post messages and the intervention DM
   - `im:write` — open a DM with the carrier
   - `users:read` — resolve user identity / timezone
   - `canvases:write` — post the morning thank-you Canvas
   - `assistant:write` — the Slack AI assistant surface
   - the **Real-Time Search / search scopes** required by the RTS API (e.g. `search:read`) — this is what feeds detection
4. Enable **Socket Mode** (Settings → Socket Mode → toggle on). Then generate an **app-level token** with the `connections:write` scope. Copy it — this is `SLACK_APP_TOKEN` (starts with `xapp-`).
5. Under **Event Subscriptions**, confirm events are enabled (the manifest sets this up) so the watcher receives channel activity.
6. Under **Slash Commands**, confirm `/quiethours` exists (the manifest creates it). This drives `/quiethours demo`.
7. **Install** the app to your sandbox (Settings → Install App). Copy the **Bot User OAuth Token** — this is `SLACK_BOT_TOKEN` (starts with `xoxb-`).
8. Copy the **Signing Secret** (Settings → Basic Information → App Credentials) — this is `SLACK_SIGNING_SECRET`.
9. Invite the bot to the channel(s) you want it to watch: in Slack, `/invite @Quiet Hours` in each channel. Note the channel IDs for `QH_WATCHED_CHANNELS`.

## b. Get an Anthropic API key **(optional)**

1. Sign in at <https://console.anthropic.com/> and create an API key. This is `ANTHROPIC_API_KEY`.
2. Set `ANTHROPIC_MODEL=claude-sonnet-5`.
3. If you skip this, Quiet Hours uses a mock handoff-note drafter so the flow still completes.

## c. Create a PagerDuty developer account **(optional)**

1. Sign up for a **free PagerDuty developer account** at <https://developer.pagerduty.com/>.
2. Create a **service** (any name — e.g. "Quiet Hours Demo").
3. Create an **on-call schedule with 2 users** so there's someone rested to page as the backup.
4. Create an **API token** (User Settings → API Access, or a REST API key). This is `PAGERDUTY_TOKEN`.
5. Note the **schedule ID** (open the schedule; the id is in the URL). This is `PAGERDUTY_SCHEDULE_ID`.
6. If you skip this, the PagerDuty MCP server runs in mock mode and returns a fake rested backup, so `get_oncall` / `page_backup` still work end to end.

## d. Fill `.env`

Copy the template and fill it in:

```powershell
Copy-Item .env.example .env
```

```dotenv
# Slack (required)
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_SIGNING_SECRET=...

# Anthropic (optional — mock fallback if omitted)
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-5

# PagerDuty (optional — mock fallback if omitted)
PAGERDUTY_TOKEN=...
PAGERDUTY_SCHEDULE_ID=...

# Quiet Hours config
QH_WATCHED_CHANNELS=C0123456789,C0987654321
QH_TIMEZONE_OFFSET_HOURS=-7
```

- `QH_WATCHED_CHANNELS` — comma-separated channel IDs the bot is invited to.
- `QH_TIMEZONE_OFFSET_HOURS` — offset used to compute the carrier's local hour for the "≥ 23:00" signal.

## e. Run

```powershell
npm install
npm start
```

You should see the Socket Mode connection come up. Then, in a watched channel:

```
/quiethours demo
```

This seeds a scripted late-night incident (`src/demo/`) and runs the whole flow: detection → intervention DM → consent → `get_oncall` → Claude handoff draft → `page_backup` → ledger update → morning Canvas.

---

## Judge access — do this before submitting

Invite **both** judge accounts to your Slack sandbox so they can evaluate the live app:

- `slackhack@salesforce.com`
- `testing@devpost.com`

In your sandbox: **Invite people** → add both emails → send. Confirm they can open the workspace and see the Quiet Hours app before you submit on Devpost.
