# Quiet Hours — Devpost Submission

*Slack Agent Builder Challenge · Track: Agent for Good · Also submitting for Most Innovative*

Everything below is ready to paste into the Devpost form, section by section.

---

## 1. Project name, tagline & elevator pitch

**Name:** Quiet Hours

**Tagline (58 chars):** An on-call agent that protects the human, not the service.

**Elevator pitch:**
Quiet Hours watches high-intensity Slack channels and notices when one person is carrying an incident alone, late at night. It sends that human a warm, honest DM built only from what it actually observed — messages sent, hours solo, local time — and on their consent it drafts a handoff note with an LLM (provider chain: Anthropic → Gemini → Cerebras, with a templated fallback) and pages a rested backup through a real PagerDuty MCP server. The next morning it posts a Canvas that thanks them for the night, so the work nobody saw doesn't stay invisible.

---

## 2. Inspiration

Anyone who has been on call knows the shape of it. You catch a 2 a.m. page, you start pulling the thread, and somewhere around hour three you realize it's still just you — everyone else is asleep, and there's no natural moment where someone says "let me take this, go rest." So you keep going, past the point where you're making good decisions, because stopping feels like dropping the ball.

This isn't a rare edge case. On-call and volunteer burnout is a well-documented pattern in SRE and developer-survey literature, and it lands hardest on small teams and nonprofits, where the same one or two people carry every late night. We didn't want to invent a statistic to dramatize it — the qualitative reality is enough: the person who happens to be awake ends up alone, and our tooling makes it worse. Every dashboard we build watches the *service* — latency, error rates, SLOs. Almost nothing watches the *human* holding it together.

Quiet Hours started from one question: what would it look like for an agent to notice the person, not just the incident — and to offer help in a way that's honest, optional, and never paternalistic?

---

## 3. What it does

Quiet Hours runs a **transparent 4-signal heuristic** over live channel activity. It intervenes only when *all four* are true at once — no black box, no wellness score:

1. **Single carrier** — one person has sent ≥ 30 messages in the incident window.
2. **No relief** — no other human has replied for ≥ 60 minutes.
3. **Late or long** — the carrier's local time is ≥ 23:00, *or* they've been solo ≥ 3 hours.
4. **Consent on file** — the person has opted in to Quiet Hours.

When it fires, the intervention flow runs end to end:

1. **It DMs the human** with a warm, honest message that states only the observed facts — "You've been on this alone for 3h 12m," the messages they sent, the quietest stretch with no reply, their local time — plus buttons. No diagnosis, no "you look burned out."
2. **On consent** ("Get me a backup" / "Hand off & sleep"), an LLM drafts a handoff note from the channel context (provider chain: Anthropic → Gemini → Cerebras, with a templated fallback), and Quiet Hours pages a **rested backup** from the on-call schedule through a PagerDuty MCP server.
3. **It confirms and steps back** — "Done. I've paged Priya and posted your handoff note. You're off the hook — go get some rest."
4. **The next morning it posts a Canvas** — "What Priya carried last night" — assembled *only* from ledger facts recorded during the incident, so the invisible night becomes visible to the team.

At every step the human keeps agency. **Keep going** and **snooze** are always one click away; the DM copy says "No pressure at all." Quiet Hours never diagnoses, never overrides, and never pages anyone without an explicit tap.

---

## 4. How we built it

Quiet Hours is a Node 22 / ESM app built on **Bolt for JavaScript in Socket Mode**, so it runs without a public URL and stays easy for judges to spin up. Four pieces do the real work:

- **RTS detection loop** (`src/detection/`). The watcher subscribes to channels and uses the Slack Real-Time Search client to pull cross-message context — who's speaking, how often, when anyone else last replied. That context feeds `heuristic.js`, the 4-signal check. This is deliberately real-time and cross-message: "one person is carrying this alone right now" is a judgment you cannot make from a single event payload, so RTS is the agent's sensory system. Remove it and the agent goes blind.

- **A real stdio MCP server for PagerDuty** (`src/mcp/`). `pagerdutyServer.js` is a genuine Model Context Protocol server exposing exactly two tools — `get_oncall` (find who's rested and available) and `page_backup` (page them with the handoff note). The intervention engine calls them through a standard MCP client over stdio. This is the actuator: detection is worthless if the fix is "post a message and hope someone volunteers." The MCP server turns the human's consent into a real page to a rested person.

- **AI-drafted handoff** (`src/agent/handoff.js`). When the human consents, an LLM drafts the handoff note from the observed channel context (provider chain: Anthropic → Gemini → Cerebras, with a templated fallback) — an honest, readable summary the backup can act on immediately, so waking someone up costs them seconds, not an archaeology dig.

- **The morning Canvas** (`src/ui/canvas.js`). Built entirely from the ledger, it's the emotional payoff: the night the team slept through, made legible and appreciated.

Underneath all of it is one rule we enforced in code — **the honest-data ledger**. The single persisted entity is an `IncidentSession` (`src/ledger/ledger.js`) that stores *only observed facts*: message counts, timestamps, the boolean results of each of the four signals. Every number any human ever sees — in the DM, in the Canvas — is drawn from those fields. There are no derived "burnout scores," no inferred state, nothing estimated. If Quiet Hours can't observe it, it doesn't say it. That constraint is what keeps the agent non-paternalistic: it shows you reality and lets you decide.

---

## 5. Social impact — Agent for Good

**Who benefits first: the people who can least afford to burn out.** Nonprofits, mutual-aid groups, open-source maintainers, and small mission-driven teams run their operations on Slack and run their on-call on the goodwill of one or two volunteers. They have no follow-the-sun rotation, no ops budget, no manager watching the clock at 2 a.m. When one person carries every late night, the failure mode isn't a missed SLO — it's that person quietly leaving, and the mission losing the human who held it up. Quiet Hours is built for exactly that person: it notices, it offers real relief, and it makes sure the night doesn't go unseen.

**Why it generalizes to every on-call team.** The dynamic Quiet Hours addresses — one human alone, late, past the point of good decisions, with no natural handoff — is universal. It shows up in hospital IT, in a two-person startup, in a Fortune 500 SRE rotation where someone's covering a gap. Because the agent reasons only from observed Slack activity and a standard PagerDuty MCP integration, it drops into any team already using those tools. Nothing about it is nonprofit-specific except our conviction about who needs it most.

**Why the design choices matter for "good."** Burnout tooling usually fails by being creepy or paternalistic — scoring people, diagnosing them, surveilling wellness. Quiet Hours refuses all of that by construction: it only ever states facts the person could verify themselves, it acts only on explicit consent, and "keep going" is always one tap away. The result is an agent that protects the human without ever taking away the human's agency — which is the difference between care and control.

---

## 6. Challenges, Accomplishments, What we learned, What's next

**Challenges.** The hardest problem wasn't technical — it was tone. An agent that DMs you at 1 a.m. about how you're doing can feel invasive in one wrong word. We rewrote the copy until every line stated an observed fact and offered, never insisted. Enforcing the honesty rule end to end also took discipline: it's tempting to compute a friendly "risk level," and we deleted every such shortcut so the ledger stays pure. Wiring a real stdio MCP server (rather than faking the PagerDuty call) meant getting the client/server handshake right so the page is a genuine tool call.

**Accomplishments.** A working end-to-end intervention — detection → DM → AI handoff → real MCP page → ledger → morning Canvas — where all three required technologies (RTS, MCP, Slack AI) are load-bearing, not decorative. A 4-signal heuristic that's fully transparent and unit-tested. And a product that stays warm and non-paternalistic while doing something genuinely useful.

**What we learned.** Designing for consent changes the architecture, not just the copy: because the human can decline at every step, the intervention had to be a proper state machine (`detected → dm_sent → consented | snoozed | keep_going → handed_off → closed`) rather than a linear script. We also learned how much trust rides on the honesty rule — the moment an agent shows one invented number, the human stops believing all of them.

**What's next.** Run against a live workspace (login is the last mile). Let teams tune the four thresholds to their own rhythm. Add more MCP actuators beyond PagerDuty (Opsgenie, VictorOps). And a weekly team Canvas that surfaces *who's been carrying the most nights* — turning invisible labor into something a team can rebalance before anyone burns out.

---

## 7. Try it — judges, in about 3 minutes

The whole flow is scripted behind one command so you can see all three required technologies in a single run.

**Setup (one time):**
1. `npm install`
2. Create the Slack app from `manifest.json` (scopes, Socket Mode, slash command — see `docs/SETUP.md`).
3. Copy `.env.example` to `.env` and add your Slack tokens. **LLM (Anthropic / Gemini / Cerebras) and PagerDuty keys are optional** — mock fallbacks let you run the entire flow without them.
4. `npm start`

**The demo — in any channel the bot is in, run:**

```
/quiethours demo
```

This seeds a scripted late-night incident and walks the whole path:

1. **See detection (RTS):** the heuristic fires on scripted RTS context; the trigger log names all four signals.
2. **See the intervention (Slack AI):** the DM arrives with observed facts and buttons. Click **Get me a backup**.
3. **See the handoff (MCP):** `get_oncall` finds a rested backup, an LLM drafts the handoff note (provider chain: Anthropic → Gemini → Cerebras, templated fallback), and `page_backup` pages them — all through the PagerDuty MCP server.
4. **See the payoff (Slack AI):** the morning Canvas is posted, built only from observed data.

RTS, MCP, and Slack AI all appear on screen in that one run.

---

## 8. Suggested gallery images

1. **The intervention DM.** The late-night message in context — header "You've been on this alone for 3h 12m 🌙," the observed-facts fields, and the **Get me a backup** / **I'm okay, keep going** buttons. *Caption: "It states only what it observed — messages sent, hours solo, your local time — then offers help you can decline."*

2. **The 4-signal trigger log.** A terminal or log panel showing all four signals evaluating true, side by side. *Caption: "No black box. Quiet Hours fires only when all four transparent signals hold at once."*

3. **The MCP handoff in flight.** A split view of `get_oncall` returning a rested backup and `page_backup` acknowledging the page. *Caption: "A real stdio MCP server turns the human's consent into an actual page to a rested backup."*

4. **The AI-drafted handoff note.** The note the backup receives, generated from channel context. *Caption: "An LLM (Gemini · Claude · Cerebras) writes the handoff so waking someone up costs them seconds, not an archaeology dig."*

5. **The morning thank-you Canvas.** "What Priya carried last night," assembled from the ledger, with the honesty footer. *Caption: "Every line was observed in Slack — the invisible night, made visible and appreciated."*

---

*Quiet Hours — built to protect the human, not just the service.*
