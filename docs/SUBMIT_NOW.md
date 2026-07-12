# Submit Now — copy-paste pack

Everything you need to go from "video recorded" to "submitted on Devpost," in order. Every field below is written to paste as-is. Deadline: **July 13, 2026, 5pm PT.**

---

## 1. YouTube upload

Upload `docs/video/quiet-hours-demo-REAL.mp4` (1:56).

**Visibility:** Unlisted.

> Note: Devpost's own rules sometimes require the video be *public*, not just unlisted-with-link. Skim the Devpost submission page's video-link field before you paste — if it says "must be public," flip the YouTube visibility to Public (Unlisted is otherwise the safer default and works everywhere Devpost just needs a link).

**Title** (under 100 chars):

```
Quiet Hours — the Slack agent that pages your backup so you can sleep
```

**Description:**

```
Quiet Hours watches high-intensity Slack channels and notices when one person is carrying an incident alone, late at night. It DMs that human a warm, honest message built only from what it actually observed — messages sent, hours solo, local time — and on their consent it drafts a handoff note with an LLM and pages a rested backup through a real PagerDuty MCP server. The next morning it posts a Canvas that thanks them for the night, so the work nobody saw doesn't stay invisible.

This is a real screen recording of Priya, a volunteer at a meals-on-wheels nonprofit, fighting a routing-service outage alone from 10:40pm to 1:47am while her backup sleeps. Watch Quiet Hours detect the pattern with Slack's Real-Time Search API, hand off through a genuine stdio MCP server to PagerDuty, and turn an invisible night into a Canvas the whole team can see.

Built for the Slack Agent Builder Challenge, Track: Agent for Good.
Repo: https://github.com/wiz-abhi/Quiet-Hours

Chapters:
0:00 Cold open — 1:47am, still alone
0:11 The overnight incident, compressed
0:34 The stakes she's carrying alone
0:41 Quiet Hours notices and offers help
0:56 Observed facts only — nothing invented
1:10 How it works: RTS · MCP · Slack AI
1:25 One tap: Hand off & sleep
1:40 Real handoff note, real PagerDuty page
1:52 The morning Canvas
```

**Tags (~10):**

```
slack, slack agent builder challenge, agent for good, on-call, burnout, pagerduty, model context protocol, mcp, slack ai, real-time search api
```

---

## 2. Devpost form — field by field

**Project title:**

```
Quiet Hours
```

**Tagline / elevator pitch:**

```
An on-call agent that protects the human, not the service.
```

**What it does / full description** (paste as the main description body):

```
Quiet Hours watches high-intensity Slack channels and notices when one person is carrying an incident alone, late at night. It sends that human a warm, honest DM built only from what it actually observed — messages sent, hours solo, local time — and on their consent it drafts a handoff note with an LLM (provider chain: Anthropic → Gemini → Cerebras, with a templated fallback) and pages a rested backup through a real PagerDuty MCP server. The next morning it posts a Canvas that thanks them for the night, so the work nobody saw doesn't stay invisible.

WHAT IT DOES

Quiet Hours runs a transparent 4-signal heuristic over live channel activity. It intervenes only when all four are true at once — no black box, no wellness score:

1. Single carrier — one person has sent ≥ 30 messages in the incident window.
2. No relief — no other human has replied for ≥ 60 minutes.
3. Late or long — the carrier's local time is ≥ 23:00, or they've been solo ≥ 3 hours.
4. Consent on file — the person has opted in to Quiet Hours.

When it fires: it DMs the human with the observed facts and action buttons; on consent, an LLM drafts a handoff note and Quiet Hours pages a rested backup through a PagerDuty MCP server; it confirms and steps back; the next morning it posts a Canvas — "What [name] carried last night" — built only from ledger facts, so the invisible night becomes visible to the team. At every step the human keeps agency: "keep going" and "snooze" are always one click away.

THE THREE REQUIRED TECHNOLOGIES

- Slack Real-Time Search API: the agent's sensory system. The detection loop pulls cross-message, permission-aware channel context — who's speaking, how often, when anyone else last replied — the judgment call ("one person is carrying this alone right now") that a single event payload can't make. Where a bot token's scopes don't reach (private history, or when no fresh action_token is available), the same detection logic runs against conversations.history as a graceful, permission-aware fallback — a reliability feature, not a shortcut, so detection never goes dark.
- A real stdio MCP server for PagerDuty: a genuine Model Context Protocol server exposing get_oncall and page_backup. This is the actuator — it turns the human's consent into a real page to a rested backup, not a message-and-hope.
- Slack AI: the Assistant/DM surface, an LLM-drafted handoff note (provider chain Anthropic → Gemini → Cerebras, with a templated fallback), and the morning Canvas.

SOCIAL IMPACT — AGENT FOR GOOD

Who benefits first: the people who can least afford to burn out. Nonprofits, mutual-aid groups, open-source maintainers, and small mission-driven teams run their operations on Slack and run their on-call on the goodwill of one or two volunteers. They have no follow-the-sun rotation, no ops budget, no manager watching the clock at 2am. When one person carries every late night, the failure mode isn't a missed SLO — it's that person quietly leaving, and the mission losing the human who held it up. Quiet Hours is built for exactly that person: it notices, it offers real relief, and it makes sure the night doesn't go unseen.

Why it generalizes to every on-call team: the dynamic Quiet Hours addresses — one human alone, late, past the point of good decisions, with no natural handoff — is universal, from hospital IT to a two-person startup to a Fortune 500 SRE rotation. Because the agent reasons only from observed Slack activity and a standard PagerDuty MCP integration, it drops into any team already using those tools.

Why the design choices matter for "good": burnout tooling usually fails by being creepy or paternalistic — scoring people, diagnosing them, surveilling wellness. Quiet Hours refuses all of that by construction: it only ever states facts the person could verify themselves, it acts only on explicit consent, and "keep going" is always one tap away. The result is an agent that protects the human without ever taking away the human's agency — which is the difference between care and control.

HOW WE BUILT IT

Node 22 / ESM on Bolt for JavaScript in Socket Mode, so it runs without a public URL. The RTS detection loop (src/detection/) feeds a 4-signal heuristic (heuristic.js). A real stdio MCP server (src/mcp/pagerdutyServer.js) exposes get_oncall and page_backup, called through a standard MCP client over stdio. An LLM drafts the handoff note (src/agent/handoff.js) via a provider chain (Anthropic → Gemini → Cerebras → template). The morning Canvas (src/ui/canvas.js) is built entirely from the ledger. Underneath all of it: the honesty-data ledger — a single persisted IncidentSession (src/ledger/ledger.js) that stores only observed facts. There are no derived "burnout scores," no inferred state, nothing estimated. If Quiet Hours can't observe it, it doesn't say it.

TRY IT — in about 3 minutes

1. Open the sandbox and run /quiethours demo in #incident-routing.
2. See detection (RTS): the heuristic fires on scripted context; the trigger log names all four signals.
3. See the intervention (Slack AI): a DM arrives with observed facts and buttons — tap "Hand off & sleep."
4. See the handoff (MCP): get_oncall finds a rested backup, an LLM drafts the handoff note, page_backup pages them — all through the PagerDuty MCP server.
5. Run /quiethours morning to see the payoff: a Canvas built only from observed data.
```

**Built with (tags):**

```
slack, bolt, socket-mode, real-time-search-api, model-context-protocol, node.js, pagerduty, gemini, cerebras, javascript
```

**Video link:**

```
<PASTE YOUTUBE LINK>
```

**GitHub repo link:**

```
https://github.com/wiz-abhi/Quiet-Hours
```

**Try-it / sandbox URL + demo steps:**

```
Sandbox: https://e0bgdc0f4bt-98q4cee8.slack.com/

In #incident-routing:
1. Run /quiethours demo — seeds a scripted late-night incident and fires detection.
2. Open the DM from Quiet Hours and tap "Hand off & sleep."
3. Run /quiethours morning to see the thank-you Canvas.
```

**Judges already invited** (note in the relevant field, e.g. "additional collaborators" or a comment — no action needed, already done):

```
slackhack@salesforce.com and testing@devpost.com have already been invited to the Slack sandbox workspace and added to #incident-routing.
```

---

## 3. Slack sandbox polish (manual, ~1 min when unlocked)

**Channel topic for #incident-routing:**

```
🌙 Quiet Hours demo — run /quiethours demo, tap "Hand off & sleep" in the DM, then /quiethours morning. Welcome, judges!
```

**Pinned message for #incident-routing:**

```
👋 Welcome, judges — thanks for taking a look at Quiet Hours!

Three steps, about 3 minutes:
1️⃣ Run `/quiethours demo` right here — it seeds a real overnight incident and detection fires on it.
2️⃣ Open the DM from *Quiet Hours* and tap *Hand off & sleep*.
3️⃣ Run `/quiethours morning` to see the thank-you Canvas.

You'll see all three required technologies along the way: the Real-Time Search API (detection), a real PagerDuty MCP server (the handoff), and Slack AI (the DM, the drafted note, and the Canvas). Questions welcome — thanks for reading this far into the night with us. 🌙
```

---

## 4. Final pre-submit checklist

- [ ] Video uploaded to YouTube, visibility set (Unlisted, or Public if Devpost requires it)
- [ ] YouTube link pasted into the Devpost video field
- [ ] Architecture diagram (`docs/architecture-diagram.png`) uploaded to the submission
- [ ] Gallery images uploaded (see `docs/DEVPOST_SUBMISSION.md` section 8 for the 5 suggested shots + captions)
- [ ] GitHub repo confirmed public: https://github.com/wiz-abhi/Quiet-Hours
- [ ] Sandbox URL correct in the submission: https://e0bgdc0f4bt-98q4cee8.slack.com/
- [ ] Both judges confirmed able to access the workspace and #incident-routing
- [ ] Channel topic and pinned message posted (section 3 above)
- [ ] Render deploy confirmed up (check logs for the 🌙 banner; `/quiethours status` responds in the sandbox)
- [ ] Track selected on Devpost: Agent for Good
- [ ] Submitted on Devpost before July 13, 2026, 5pm PT
