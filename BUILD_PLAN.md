# 🔨 Quiet Hours — Detailed Build Plan

> **Project:** Quiet Hours — *"An on-call agent that protects the human, not just the service."*
> **Track:** Agent for Good · **Target prizes:** Agent for Good 1st ($8k) + Most Innovative ($2k)
> **Timeline:** July 6 → **submit July 12** (deadline July 13, 5pm PT — we submit a day early)
> **Team:** Solo (you) · **Platform:** Windows 11 dev machine

---

## 0. Product Definition (freeze this — no scope creep)

### The one sentence
Quiet Hours watches high-intensity Slack channels in real time; when it detects one person carrying an incident alone late at night, it intervenes — silences non-critical pings, drafts a handoff, pages a rested backup via PagerDuty, and posts a warm "what you saved" Canvas the next morning built ONLY from data it actually observed.

### The five features (in priority order — ship top-down, cut bottom-up)

| # | Feature | Description | Status gate |
|---|---------|-------------|-------------|
| F1 | **Lonely-firefighter detection** | RTS-driven loop: single sender > 30 msgs, no other human reply > 60 min, local time > 23:00 → trigger | MUST ship |
| F2 | **The 1:47am DM** | Private, warm, actionable DM: observed stats + Block Kit buttons `[Hand off & sleep] [Keep going] [Snooze 30m]` | MUST ship |
| F3 | **PagerDuty handoff (MCP)** | One MCP tool: read on-call schedule, page backup with an auto-drafted context handoff note | MUST ship |
| F4 | **Morning "thank you" Canvas** | 8am Canvas in #general: solo-minutes, messages sent, pings silenced, backup paged time, incident duration. Only observed numbers. | MUST ship |
| F5 | **Ping silencing** | Rate-limit/queue non-critical bot notifications during the solo window; deliver digest after | SHOULD ship (degrade: simulate with a visible "4 pings held" counter) |

### Explicitly OUT of scope (do not build)
- ❌ Sentiment/trauma analysis or any ML claims — the heuristic is 4 transparent signals, shown to the user
- ❌ Any invented business metrics (meals, dollars, deliveries)
- ❌ Multi-workspace support, admin dashboards, settings UI beyond one config command
- ❌ Opsgenie/other integrations — PagerDuty only
- ❌ Mobile-specific anything

### The transparent heuristic (this IS the product's honesty story)
```
TRIGGER = (messages_by_one_human >= 30 in active thread/channel)
      AND (no other human message for >= 60 min)
      AND (local_time >= 23:00 OR duration_solo >= 3h)
      AND (user has opted in via /quiethours optin)
```
Show these four numbers to the user in the DM itself. Never say "we think you're burned out." Say "you've been on this alone for 3h12m — 47 messages, no one else online."

---

## 1. Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        SLACK WORKSPACE                          │
│  #incident channel   ·   DM to user   ·   #general (Canvas)     │
└──────┬─────────────────────────▲───────────────▲───────────────┘
       │ Events API /            │ chat.postMessage│ canvases.create
       │ RTS API (context)       │ (Block Kit DM)  │
┌──────▼──────────────────────────────────────────────────────────┐
│                    QUIET HOURS AGENT (Bolt for JS)               │
│                                                                  │
│  ┌────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │ Watcher loop    │  │ Intervention     │  │ Morning Canvas  │  │
│  │ (RTS polling +  │─▶│ engine           │─▶│ generator       │  │
│  │ events, applies │  │ (DM + Block Kit  │  │ (observed-data  │  │
│  │ the heuristic)  │  │  actions)        │  │  ledger only)   │  │
│  └────────────────┘  └────────┬─────────┘  └─────────────────┘  │
│                               │                                  │
│                    ┌──────────▼──────────┐                       │
│                    │  Claude (Agent SDK)  │  drafts handoff note │
│                    │  + MCP client        │  in user's voice     │
│                    └──────────┬──────────┘                       │
└───────────────────────────────┼──────────────────────────────────┘
                                │ MCP tools
                     ┌──────────▼──────────┐
                     │  PagerDuty MCP tool  │  get_oncall_schedule
                     │  (real dev account)  │  page_backup(context)
                     └─────────────────────┘
```

**Required-tech checklist (say all three in the video + diagram):**
- ✅ **RTS API** — the watcher loop reads live channel context, permission-aware. Load-bearing: webhook bots cannot see "one person alone."
- ✅ **MCP server integration** — PagerDuty schedule read + page as MCP tools invoked by the agent.
- ✅ **Slack AI capabilities** — Assistant/agent surface + AI-drafted handoff note + Canvas generation.

### Stack decisions (locked)
| Layer | Choice | Why |
|---|---|---|
| App framework | **Bolt for JavaScript** + Slack CLI | Official starter `slack-samples/bolt-js-starter-agent` uses it; fastest path |
| LLM | **Claude via Agent SDK** (`ANTHROPIC_API_KEY`) | First-party sample support; handoff-note drafting + tool use |
| MCP | Custom lightweight MCP server (Node) wrapping PagerDuty REST v2 | Two tools only: `get_oncall`, `page_backup` |
| State | SQLite (better-sqlite3) or a JSON ledger file | Solo project; the "observed-data ledger" needs zero infra |
| Hosting (dev) | `slack run` (Socket Mode) locally; deploy to Render/Railway free tier for judging window | Judges click the sandbox for 3 weeks after deadline — it must stay up |
| Video | OBS Studio (free) + DaVinci Resolve or CapCut (free) | Screen capture + cuts + captions |

### Data model (the "ledger" — single source of truth for the Canvas)
```js
incident_session {
  id, channel_id, user_id,
  started_at, ended_at,
  solo_minutes,            // observed
  message_count,           // observed
  pings_silenced: [...],   // observed (bot notifications held)
  backup_user, paged_at,   // observed (PagerDuty response)
  handoff_note_ts,         // link to the drafted note
  status: watching | intervened | handed_off | resolved
}
```
**Rule:** the Canvas renders ONLY fields from this table. If it's not in the ledger, it doesn't go on the Canvas.

---

## 2. Day-by-Day Plan

### 📅 Day 1 — Sun Jul 6 (today): Foundation + Detection skeleton
**Goal by midnight: bot deployed to sandbox, DM fires from a hardcoded trigger.**

- [ ] Create Slack developer sandbox workspace (developer program → sandbox)
- [ ] Install Slack CLI (Windows installer), `slack login`
- [ ] `slack create quiet-hours --template bolt-js-starter-agent` (or clone `slack-samples/bolt-js-starter-agent`)
- [ ] `.env`: `ANTHROPIC_API_KEY`, Slack app tokens; `slack run` working (Socket Mode)
- [ ] Request scopes: `channels:history`, `channels:read`, `chat:write`, `im:write`, `users:read`, `canvases:write`, `assistant:write` + **RTS/search scopes** (`search:read` family — check current docs; apply early, this can gate you)
- [ ] Hardcode heuristic v0: on `/quiethours test`, run detection against current channel history and DM you the four observed numbers
- [ ] Commit to a fresh GitHub repo (`quiet-hours`), README stub
- ⚠️ **Risk to burn down today:** RTS scope availability in sandbox. If RTS access is gated/delayed, file for it NOW and fall back to `conversations.history` polling with an explicit code path labeled to swap in RTS (but you need real RTS calls in the final build — it's a scored requirement).

### 📅 Day 2 — Mon Jul 7: Real detection loop + PagerDuty MCP
**Goal: end-to-end — I type messages alone in a channel, the bot detects and DMs; button press pages a real PagerDuty schedule.**

- [ ] Watcher loop: subscribe to `message` events per watched channel; maintain rolling state (sender counts, last-other-human timestamp); evaluate heuristic every message + every 5 min timer
- [ ] Use **RTS API** to pull thread/channel context when trigger fires (this is where RTS is visibly load-bearing — log the call, show it in architecture)
- [ ] `/quiethours watch #channel` + `/quiethours optin` commands (opt-in = consent story for judges)
- [ ] PagerDuty free developer account → create a service, an escalation policy, a 2-person schedule (you + a second dummy user)
- [ ] Build the MCP server: `get_oncall(schedule_id)` and `page_backup(user, context_note)` wrapping PagerDuty REST v2
- [ ] Wire the agent's Claude tool-use to call MCP tools; on `[Hand off & sleep]` button: fetch schedule → draft handoff → page backup → confirm in DM
- 🚦 **PIVOT GATE (end of Day 2):** If PagerDuty MCP can't flip a schedule/page on camera in <3s, OR RTS scopes are still blocked with no ETA → execute the **Marginalia pivot** (see [IDEAS_RANKED.md](IDEAS_RANKED.md)). Decide tonight, not later.

### 📅 Day 3 — Tue Jul 8: The 1:47am DM + handoff note quality
**Goal: the intervention moment is beautiful.**

- [ ] Design the DM with Block Kit: header ("You've been on this alone for 3h 12m"), the four observed stats as fields, context quote of the incident's first message, three buttons
- [ ] AI-drafted handoff note (LLM provider chain: Anthropic → Gemini → Cerebras, with a templated fallback): prompt takes RTS-retrieved thread context → produces a short, warm, specific note ("the flaky routing job restarts every 20 min; last good deploy was 22:40; Maria from ops was asking in #logistics") — post as the DM to the backup + link in thread
- [ ] `[Keep going]` and `[Snooze 30m]` paths (respect autonomy — this is the anti-paternalism answer)
- [ ] Ping silencing (F5): intercept/queue the bot-notification firehose — simplest honest version: a `pings_silenced` counter for messages from bots/webhooks in the watched channel during the solo window, delivered as a digest with the morning Canvas
- [ ] Write ledger records for everything observed

### 📅 Day 4 — Wed Jul 9: Morning Canvas + polish pass
**Goal: the 8:04am payoff photographs beautifully.**

- [ ] Canvas generator (`canvases.create`): title *"What Priya saved last night"* — sections: timeline (trigger → handoff → resolution), the four observed numbers as big stats, the handoff note excerpt, a genuine thank-you line, "every number on this page was observed in Slack" footer (that footer is a judging weapon)
- [ ] Schedule Canvas post for morning (or `/quiethours morning` trigger for demo determinism)
- [ ] Error handling: PagerDuty down → DM still fires with manual handoff draft; RTS call fails → fall back to events cache; never crash silently
- [ ] Empty/edge states: two people in channel (no trigger), opted-out user (no DM), second trigger same night (cooldown)
- [ ] App Home tab: status ("watching 2 channels · 1 quiet night this week"), opt-in toggle
- [ ] Copy pass on every string — warm, human, zero corporate tone

### 📅 Day 5 — Thu Jul 10: Demo seeding + deploy + repo
**Goal: a judge clicking the sandbox reproduces the magic deterministically.**

- [ ] Write the **seed script**: replays a scripted ~40-message "delivery-routing outage" conversation (written by hand, authentic texture: typos, timestamps, frustration) into #incident-routing as a realistic solo-firefight; script also fast-forwards clock conditions so the trigger fires
- [ ] `/quiethours demo` command for judges: seeds, triggers, and walks them through DM → handoff → Canvas in ~2 minutes (put instructions in channel topic + README)
- [ ] Deploy to Render/Railway (switch from Socket Mode to HTTP if needed, or keep Socket Mode on a worker) — must survive July 14 → Aug 6 judging window
- [ ] Invite **slackhack@salesforce.com** and **testing@devpost.com** to the sandbox; verify from an incognito test account that the demo flow works
- [ ] Repo polish: README (what/why/architecture/setup/env vars), architecture diagram committed, license, clean commit history

### 📅 Day 6 — Fri Jul 11: Video day (this is where you win)
**Goal: a finished ≤2:50 video.**

- [ ] Write the script FIRST (below). Record voiceover separately from screen capture
- [ ] Capture the two-shot core: (1) 01:47am DM moment with the incident channel visible, (2) 08:04am Canvas reveal
- [ ] Capture B-roll: PagerDuty schedule flipping in split-screen (proves it's real), the "receipts" (RTS call → context quote), App Home
- [ ] 15-second whiteboard/diagram segment naming **RTS + MCP + Slack AI** explicitly
- [ ] Edit: captions on everything, no dead air, royalty-free music low in the mix, cut to ~2:40
- [ ] Upload unlisted to YouTube; test the link logged out

**Video script skeleton (2:40):**
| Time | Beat |
|---|---|
| 0:00–0:12 | Black screen, clock reads 1:47 AM. Hook line: *"It's 1:47 in the morning, and Priya has been fighting this outage alone for three hours — and nobody at her nonprofit knows."* Show the wall of 47 solo messages. |
| 0:12–0:40 | The DM arrives. Read it aloud. Show the four observed numbers. She taps **[Hand off & sleep]**. |
| 0:40–1:10 | Split screen: PagerDuty schedule flips LIVE; backup gets paged with the AI-drafted handoff note. *"Real schedule. Real page. Three seconds."* |
| 1:10–1:40 | Hard cut: 8:04 AM. The Canvas: *"What Priya saved last night."* Linger on the numbers + the footer: *"every number observed in Slack."* |
| 1:40–2:05 | Architecture: 15s diagram walkthrough — *"Slack's Real-Time Search API sees what webhooks can't: one person, alone. MCP turns rest into an action. Claude writes the handoff."* |
| 2:05–2:40 | Impact close: volunteer burnout stats (real, cited), who this serves, the line: *"Every incident tool optimizes for the service. Quiet Hours optimizes for the human."* Logo. |

### 📅 Day 7 — Sat Jul 12: SUBMIT
- [ ] Devpost form: track (**Agent for Good**), title, tagline, thumbnail (the 1:47am DM screenshot works)
- [ ] Text description (adapt from README; lead with the social-impact explanation — required for this track)
- [ ] Video link, architecture diagram upload, sandbox URL, GitHub link
- [ ] Re-verify sandbox access for both judge emails from a clean account
- [ ] **SUBMIT.** Screenshot the confirmation.
- 🧯 Jul 13 = buffer only. Fix, don't build.

---

## 3. Demo Seed Content (write once, Day 5)

The scripted incident that everything demos against — hand-write ~40 messages with authentic texture:
- **Scenario:** "Meals on Rails," a food-bank logistics nonprofit; the delivery-routing service is failing the night before a 2,300-delivery day *(the 2,300 lives in the story dialogue Priya types, NOT in agent-generated metrics — the agent only reports what it observed)*
- **Cast:** Priya (solo volunteer firefighting), Marcus (backup, asleep), a webhook bot spamming error alerts (fuel for the pings-silenced counter)
- **Arc:** 22:40 first error → escalating solo debugging → 01:47 trigger → handoff → 03:30 Marcus stabilizes → 08:04 Canvas

---

## 4. Scoring Map (how each build item pays judging rent)

| Judging criterion (25% each) | What earns it |
|---|---|
| **Tech Implementation** | RTS as load-bearing detection (visible in receipts UI + logs), real PagerDuty MCP tools, Claude tool-use, clean repo |
| **Design** | Block Kit DM, the Canvas, App Home, warm copy, consent/opt-in flow, snooze/keep-going autonomy |
| **Potential Impact** | Volunteer/on-call burnout is documented (cite Stack Overflow dev survey + SRE literature); generalizes from nonprofits to every on-call team on Slack |
| **Quality of Idea** | "Burnout as primary telemetry" — every incident tool optimizes MTTR; this one optimizes the human. Nobody else will submit this. |

**Most Innovative ($2k) angle:** the inversion — an agent whose success metric is *a person going to sleep*.

---

## 5. Risk Register

| Risk | Likelihood | Mitigation | Deadline |
|---|---|---|---|
| RTS scopes gated/delayed in sandbox | Med | Apply Day 1; poll support; events-cache fallback in code | Gate: Day 2 |
| PagerDuty MCP friction | Low-Med | Free dev account is instant; only 2 endpoints needed | Gate: Day 2 |
| Canvas API limitations (formatting) | Med | Design within markdown-ish limits Day 4; screenshot-worthy > fancy | Day 4 |
| Demo non-determinism | Med | `/quiethours demo` scripted replay; video uses the golden path | Day 5 |
| Hosting dies during judging | Med | Deploy Day 5, add uptime ping (cron-job.org), check weekly through Aug 6 | Day 5+ |
| Scope creep | High (it's you) | The five-feature table is law. F5 is the only cuttable item. | Always |
| **Pivot trigger** | — | Day 2 EOD: PagerDuty <3s on camera + RTS working, else → Marginalia | **Jul 7, 11pm** |

---

## 6. Definition of Done (submission-ready checklist)

- [ ] F1–F4 work end-to-end in the sandbox from a cold `/quiethours demo`
- [ ] Both judge emails have working access (verified from a clean account)
- [ ] Video ≤3:00, public link, captioned, shows RTS + MCP + Slack AI on screen
- [ ] Architecture diagram exported (PNG/PDF) and uploaded
- [ ] Devpost description includes the social-impact section
- [ ] GitHub repo public with real README
- [ ] Deployed instance stable + uptime monitoring on
- [ ] Submitted **July 12**, confirmation screenshot saved

---

*Companion docs: [WINNING_STRATEGY.md](WINNING_STRATEGY.md) (hackathon strategy) · [IDEAS_RANKED.md](IDEAS_RANKED.md) (idea analysis + Marginalia pivot details)*
