# Deploying Quiet Hours for the judging window (July 14 – Aug 6)

Quiet Hours runs in **Socket Mode** — it dials *out* to Slack over a websocket.
That means: **no inbound HTTP port, no public URL, no webhook config.** Any
host that can keep one small Node process alive works. The judges never talk
to this server; they talk to Slack, and Slack talks to our websocket.

## Option A — Railway (recommended, simplest)

1. Push the repo to GitHub (private is fine).
2. https://railway.app → **New Project → Deploy from GitHub repo** → pick the repo.
   Railway detects the `Dockerfile` automatically.
3. In the service → **Variables**, add (copy values from your local `.env`):
   - `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_SIGNING_SECRET`
   - `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-3-flash-preview`
   - `CEREBRAS_API_KEY`, `CEREBRAS_MODEL=gpt-oss-120b`
   - (optional) `PAGERDUTY_TOKEN`, `PAGERDUTY_SCHEDULE_ID`
   - `QH_TIMEZONE_OFFSET_HOURS` = your demo timezone offset (e.g. `5` for IST-ish
     whole-hour approximation; the demo path doesn't depend on it)
4. Deploy. Check the service logs for the banner:
   `🌙 Quiet Hours is awake and watching over on-call.`
5. **Stop the local `npm start`** — two connected instances would both respond
   and double-post. One instance at a time, always.
6. Test from Slack: `/quiethours status` → then a full `/quiethours demo`.

Free-tier note: Railway's trial credit comfortably covers a tiny always-on
Node process for the 3-week judging window.

## Option B — Render

The repo ships a `render.yaml` blueprint and the app exposes a tiny HTTP
health endpoint on `PORT`, so it runs on Render's **free Web Service** tier
(Background Workers are paid-only on Render).

1. https://render.com → **New → Blueprint** → connect the GitHub repo
   (`wiz-abhi/Quiet-Hours`). Render reads `render.yaml` automatically.
2. When prompted, fill the secret env vars: `SLACK_BOT_TOKEN`,
   `SLACK_APP_TOKEN`, `SLACK_SIGNING_SECRET`, `GEMINI_API_KEY`,
   `CEREBRAS_API_KEY`. (Non-secret defaults come from the blueprint.)
3. Deploy and watch logs for the 🌙 banner, then run the Slack-side test.
4. **Keep-awake (required on the free tier):** free web services spin down
   after ~15 min without inbound HTTP, which kills the Slack websocket.
   Create a free monitor at https://uptimerobot.com or https://cron-job.org
   that GETs your service URL (e.g. `https://quiet-hours.onrender.com/`)
   every 5–10 minutes. This doubles as your uptime alerting for the
   judging window.

## Option C — Anything with Docker

```bash
docker build -t quiet-hours .
docker run -d --restart=always --env-file .env --name quiet-hours quiet-hours
```

A $4/mo VPS, a spare machine, or a friend's homelab all work.

## Post-deploy checklist

- [ ] Logs show the 🌙 banner and no auth errors
- [ ] Local dev instance STOPPED (never two at once)
- [ ] `/quiethours status` responds in the sandbox
- [ ] Full `/quiethours demo` → DM → handoff → `/quiethours morning` run clean
- [ ] `slackhack@salesforce.com` and `testing@devpost.com` invited to the sandbox
- [ ] Channel topic in #incident-routing tells judges: "Run `/quiethours demo`,
      tap *Hand off & sleep* in the DM, then `/quiethours morning`."
- [ ] Set a reminder to check the logs weekly through Aug 6

## Rotating the temporary tokens (you said you'd revoke them)

When you revoke and regenerate after testing:
1. api.slack.com/apps → OAuth & Permissions → reinstall/regenerate bot token;
   Basic Information → regenerate the app-level token.
2. Update the two variables on the host (Railway/Render dashboard) — no
   redeploy of code needed, just restart the service.
