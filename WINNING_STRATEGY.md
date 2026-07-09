# 🏆 Slack Agent Builder Challenge — Battle Plan to Win

> **Goal:** Win a track prize (ideally + a special award) at the Slack Agent Builder Challenge.
> **Reality check:** 3,673 registered, but the vast majority never submit a finished, polished project. Real competition is a few hundred serious entries. A focused, well-demoed agent that *shows off Slack's newest APIs* has a genuine shot.
> **Time left:** Today is **July 6, 2026** → submission deadline **July 13, 2026, 5:00 PM PT**. You have ~7 days.

---

## 1. The Challenge, Decoded

**What it is:** Build an AI **agent** that lives inside Slack and automates workflows, surfaces insights, or connects systems.

**Hard requirement — you MUST use at least one of:**
1. **Slack AI capabilities**
2. **MCP server integration** (Model Context Protocol)
3. **Real-Time Search (RTS) API**

> 💡 **Winning move:** Use **all three, or at least MCP + RTS**. These are Slack/Salesforce's brand-new flagship APIs — they are *actively promoting them* and the judges are Slack people. A project that showcases their newest platform features scores disproportionately well on "Technological Implementation" and signals you understood the assignment.

### The three tracks

| Track | What it is | Bar to enter | Competition | My take |
|---|---|---|---|---|
| **New Slack Agent** | Any agent that automates/connects/surfaces insight | Low | 🔴 Highest (most entrants) | Great idea needed to stand out |
| **Agent for Good** | Social impact: accessibility, education, environment, public health, nonprofits | Low | 🟡 Medium | ⭐ **Best expected value** — impact story is a gift for judging |
| **Agent for Organizations** | New/updated **Marketplace** app | 🔴 **Very high** — must be installed in **5 active workspaces** + **production** deployment (not sandbox) | 🟢 Lowest | Skip unless you already have a real app + workspaces |

### Prize pool — $42,000

- Each track: **1st = $8,000**, **2nd = $4,000**
- **Best UX = $2,000**, **Most Innovative = $2,000**, **Best Technological Implementation = $2,000**
- Plus: Slack Developer Certification vouchers, Dreamforce 2026 tickets, swag, media features.

> 💡 **Double-dip strategy:** Your submission competes for **its track prize AND all three special awards simultaneously**. So the play is: pick a track you can win, then *deliberately over-invest in one special-award dimension* (UX, innovation, or tech) to catch a second prize.

### Judging criteria — **all four equally weighted (25% each)**

1. **Technological Implementation** — code quality + how well you leverage the required tech
2. **Design** — UX, interface thoughtfulness, front/back-end balance
3. **Potential Impact** — community reach and broader implications
4. **Quality of the Idea** — creativity, uniqueness, improvement over existing solutions

### Key dates
- **Submit by:** July 13, 2026, 5:00 PM PT
- Judging: July 14 – Aug 6 · Winners announced: **Aug 11, 2026**

### Eligibility (confirm you qualify)
- 18+, from an eligible country (**India is included** ✅), teams up to **4** people.
- Not a Salesforce employee / relative, etc.

---

## 2. The Winning Thesis

You win this hackathon on **four levers, in this priority order:**

1. **A demo video that makes a judge feel something in the first 15 seconds.** Judges watch *hundreds* of 3-minute videos. This is where 80% of the outcome is decided. A mediocre idea with a crisp, emotional, "it actually works" demo beats a brilliant idea with a shaky screen recording.
2. **A sharp, differentiated idea** that isn't the 200th "summarize my channel" bot.
3. **Visible use of Slack's newest tech** (RTS + MCP) — shown *on screen* and in your architecture diagram.
4. **Design polish** — Block Kit UI, Canvases, clean interactions. Looks like a real product, not a script.

Everything below serves those four levers.

---

## 3. My Recommendation: Track + Idea

### 🥇 Primary recommendation — **"Agent for Good"** track

**Why:** Lower competition than "New Agent," avoids the brutal 5-workspace requirement of "Organizations," and the **Potential Impact** criterion (25% of the score) is basically pre-won by the track's nature. Social-impact demos are also the most emotionally resonant on video — which is exactly where you win.

### The flagship idea: **"Aria" — the Slack Accessibility & Inclusion Agent**

An agent that makes Slack itself usable for people who are currently left behind: people with visual impairments, cognitive/reading differences, non-native English speakers, and neurodivergent users.

**What it does (all demoable in 3 minutes):**
- **"Catch me up, accessibly"** — uses the **RTS API** to read a noisy channel/thread in real time and produce a *plain-language*, screen-reader-optimized digest (short sentences, no jargon, structured).
- **Auto alt-text** — when an image is posted, the agent generates a description and offers to attach it as alt text (visual accessibility). It also **flags** posts that shipped images with no alt text.
- **Jargon & acronym decoder** — hover/ask and it explains company jargon by pulling real definitions from Slack history via RTS.
- **Simplify + translate** — rewrites a dense message into plain language and/or the reader's language on demand.
- Outputs go into a clean **Slack Canvas** so they're persistent and shareable.

**Why it scores on all 4 criteria:**
- **Impact (25%):** Accessibility = huge, undeniable social good. Easy, credible story. ~16% of the world lives with a disability.
- **Idea (25%):** Everyone else builds productivity bots. "Accessibility agent" is memorable and rarely done well.
- **Design (25%):** Accessibility *is* design — this is your natural path to the **Best UX ($2k)** award. Lean into it hard.
- **Tech (25%):** RTS (live context) + MCP (tools: read channel, post, manage canvas) + Slack AI. Uses the flagship stack.

> This single project realistically competes for **Agent for Good 1st ($8k) + Best UX ($2k)**.

### Strong alternatives (pick based on your interest/skills)

**If you'd rather do "New Slack Agent" (productivity, enterprise-flavored):**

- **⭐ "Sentinel" — the AI Incident Commander.** When something breaks, it uses **RTS in real time** to pull relevant threads, error reports, and who-said-what, then auto-drafts the incident timeline + stakeholder comms into a Canvas, and coordinates responders. *RTS was practically built for this* — real-time is the whole point. This is your best shot at **Best Technological Implementation ($2k)** because it genuinely needs the real-time API. Enterprise judges love it.
- **"Onboard" — Institutional Memory agent.** New hires ask "how do we do X here?" and it answers *from your actual Slack history* via RTS instead of pinging humans. Kills repetitive questions. Very marketplace-viable, but a slightly crowded concept — differentiate with quality.
- **"Loop" — Cross-tool project agent.** Uses **MCP** to connect Slack ↔ (GitHub/Linear/Notion) and gives a single natural-language surface: "what's blocking the launch?" pulls from everywhere. Great for showcasing **MCP breadth**.

**If you have education/nonprofit access (still Agent for Good):**
- **"Mentor" for student/community Slacks** — answers learner questions from pinned resources via RTS, tracks who's stuck, nudges gently. Big impact story if you can show a real community.

### Idea selection tiebreaker
Ask: *"Can I film a 20-second clip of this working that makes a stranger go 'oh, that's cool / that matters'?"* If yes → build it. If it takes 2 minutes of setup to explain → drop it.

---

## 4. Recommended Technical Stack (built to move fast in a week)

Slack has first-party scaffolding that gets you to a running agent in an hour. **Do not build from scratch.**

```
┌─────────────────────────────────────────────────────────┐
│                        SLACK                             │
│   User @mentions / DMs the agent  ·  App Home  ·  Canvas │
└───────────────┬─────────────────────────────────────────┘
                │  events / assistant thread
        ┌───────▼────────┐
        │   Bolt app      │  (Bolt for JS or Python)
        │  (your agent)   │
        └───┬─────────┬───┘
            │         │
   ┌────────▼──┐   ┌──▼──────────────┐
   │ Agent SDK │   │  Slack MCP      │  ← tools: search messages,
   │ (Claude/  │   │  Server         │    read channels/threads,
   │  OpenAI)  │   │                 │    post, manage canvases
   └────┬──────┘   └──┬──────────────┘
        │             │
        │        ┌────▼───────────────┐
        │        │ Real-Time Search   │  ← permission-aware,
        │        │ (RTS) API          │    live channel/thread context
        │        └────────────────────┘
        ▼
   LLM reasoning (Claude Agent SDK recommended)
```

**Stack choices:**
- **Slack CLI + Bolt** — official toolkit. Scaffold with `slack create agent`, run with `slack run`.
- **Agent framework:** **Claude Agent SDK** (there's an official `slack-samples/bolt-js-starter-agent` using it; you're already in the Claude ecosystem). OpenAI Agents SDK and Pydantic AI are also supported.
- **Slack MCP Server** — gives your agent standardized tools (search, read, post, canvas) with OAuth/permissions handled for you. This checks the "MCP integration" box.
- **RTS API** — permission-aware, real-time context. This checks the "RTS" box and is the differentiator judges reward.
- **UI:** **Block Kit** for buttons/menus, **Canvases** for rich persistent output. This is your Design score.

**Fast-start resources:**
- Quickstart: `slack create agent` → configure `.env` (`ANTHROPIC_API_KEY`) → `slack run`
- Starter repos: `slack-samples/bolt-js-starter-agent` (Claude + OpenAI SDK), Bolt Python starter, and the "Casey" full support-agent sample.

> ✅ **Minimum to satisfy the rules:** even one required tech qualifies — but use **RTS + MCP together** to win the tech criterion. The whole platform push this year *is* RTS + MCP; align with it.

---

## 5. The Demo Video — Where You Actually Win (spend ~1.5 days here)

Judges watch a huge volume of 3-min videos. Treat this as the product. **Under 3 minutes, English, hosted publicly on YouTube/Vimeo (unlisted is fine).**

**Structure (target 2:30–2:50):**
1. **0:00–0:15 — The hook.** No logos, no "hi my name is." Open on the *problem, felt*. For Aria: a wall of jargon-filled Slack messages + a line like *"For 1 in 6 people, this is unreadable."* Then: *"Meet Aria."*
2. **0:15–0:45 — The one killer demo.** Show the single most impressive action working live, end-to-end, in Slack. Real UI, real response. No slides yet.
3. **0:45–1:45 — 2–3 more features**, fast, each solving a real moment. Show the **Canvas output** and **Block Kit** interactions. Keep it moving.
4. **1:45–2:15 — Architecture (10–15s) + "how it works":** flash your clean architecture diagram, name-drop **RTS + MCP + Slack AI** explicitly ("...using Slack's Real-Time Search API for live, permission-aware context and the MCP server for tools").
5. **2:15–2:45 — Impact close.** Who this helps and how far it reaches. End on the tagline + name.

**Production rules:**
- Record at high resolution, zoom the Slack UI so text is readable.
- **Script it and do voiceover** — no dead air, no "um, let me click here."
- Add captions/subtitles (on-brand for an accessibility project, and helps every judge).
- Cut ruthlessly. A tight 2:20 beats a rambling 2:59.
- No copyrighted music — use royalty-free.
- Show it **working**, not described. "It works" is the single most persuasive thing on camera.

---

## 6. Submission Checklist (miss one = disqualified)

- [ ] **Track selected** (New / Good / Organizations)
- [ ] **Text description** — features + functionality, clearly written
- [ ] **Social impact explanation** (required for "Agent for Good")
- [ ] **Demo video** — under 3 min, public (YouTube/Vimeo/etc.), English or subtitled, shows it working
- [ ] **Architecture diagram** — clean, labeled, shows RTS/MCP/Slack AI
- [ ] **Slack developer sandbox URL** with **test access granted to `slackhack@salesforce.com` AND `testing@devpost.com`** ← easy to forget, mandatory
- [ ] **Slack App ID** (only if "Organizations" track / new app)
- [ ] Original work, no third-party IP violations, no confidential data
- [ ] Devpost gallery: strong **title, tagline, and thumbnail image** (judges see these first)
- [ ] Submitted before **July 13, 5:00 PM PT** (submit a **day early** — deadlines crash under load)

---

## 7. 7-Day Execution Plan (July 6 → July 13)

| Day | Date | Focus | Deliverable by end of day |
|---|---|---|---|
| **1** | Jul 6 (today) | Decide track + idea. Set up: Slack CLI, sandbox workspace, `slack create agent`, run the starter. Get "hello world" agent replying in Slack. | Agent responds to a mention |
| **2** | Jul 7 | Wire the LLM (Claude Agent SDK) + **MCP server** tools. Agent can read a channel and post. | Agent reads + acts on real messages |
| **3** | Jul 8 | Integrate **RTS API** for live, permission-aware context. Build **feature #1** (your killer demo). | Killer feature works end-to-end |
| **4** | Jul 9 | Build features #2–#3. Add **Canvas** output + **Block Kit** buttons. | Full feature set functional |
| **5** | Jul 10 | **Design/UX polish pass.** Error handling, loading states, nice copy, empty states. Make it feel like a product. | Demo-ready, no rough edges |
| **6** | Jul 11 | **Record + edit the video.** Write the script first. Create the **architecture diagram**. Draft the write-up. | Video + diagram + draft text done |
| **7** | Jul 12 | Final polish. Fill Devpost form, grant sandbox test access, upload everything, write tagline. **SUBMIT.** | ✅ Submitted (a full day early) |
| Buffer | Jul 13 | Fix anything, re-record a clip if needed. Do **not** rely on this day. | — |

> If you're solo and time-pressed: cut to **one flagship feature done flawlessly** + 1 supporting feature. Depth-of-polish on one thing beats five half-working things on video.

---

## 8. How to Score Max on Each Criterion (cheat sheet)

**Technological Implementation (25%)**
- Use **RTS + MCP** (not just one). Say so, on screen and in the diagram.
- Clean, public GitHub repo with a real README (setup steps, arch, env vars). Judges may click it.
- Handle errors gracefully; show permission-awareness (RTS respects who can see what — mention it).

**Design (25%) → also your Best UX play**
- Block Kit interactions (buttons, selects), not walls of text.
- Canvases for rich, persistent output.
- Thoughtful copy, sensible defaults, fast responses, clear affordances.
- If accessibility is your theme: captions, plain language, screen-reader-friendly = design *and* impact.

**Potential Impact (25%)**
- Quantify it: who is affected, how many, how much time/pain saved. Use a real number.
- Show it generalizes beyond your demo workspace.

**Quality of Idea (25%)**
- Be the memorable one. Avoid generic "summarizer" framing.
- State explicitly how you improve on what exists today ("today people do X manually / ask a human / can't do it at all").

---

## 9. Pitfalls & Disqualifiers to Avoid

- ❌ **Forgetting to grant sandbox test access** to `slackhack@salesforce.com` + `testing@devpost.com`. Judges can't test → you lose.
- ❌ Video over 3 minutes, private/unlisted-broken link, or copyrighted music.
- ❌ Missing architecture diagram (it's mandatory).
- ❌ Picking "Organizations" track without meeting the **5 active workspaces + production** bar — near-impossible in a week from scratch.
- ❌ Building something that only works in a scripted demo. If a judge opens your sandbox and it's broken, all the video polish is wasted.
- ❌ Submitting at 4:59 PM on the 13th. Servers get hammered. **Submit July 12.**
- ❌ Over-scoping. Five broken features < one great one.

---

## 10. Advanced Edge-Plays (optional, if you have capacity)

- **Two-track double submission:** rules allow multiple submissions *if substantially different*. A team of 3–4 could ship Aria (Good) **and** Sentinel (New Agent) to double the surface area. Only do this if you can keep both polished — a diluted pair loses to one sharp entry.
- **Recruit up to 3 teammates.** A designer for the video/UI alone can be the difference for the UX award. Prize scales with team (shared).
- **Get one real testimonial.** If a real person from a nonprofit / a disabled user / a real team says "I'd use this" — put that quote in the video. Judges weight real-world validation heavily on Impact.
- **Publish a short build blog / X thread** tagging Slack developers. Doesn't affect judging directly, but "media features" is a listed prize and visibility never hurts.

---

## TL;DR — Do This

1. **Track:** Agent for Good (fallback: New Slack Agent with "Sentinel" incident agent).
2. **Build:** **Aria**, the Slack accessibility agent — RTS for live context, MCP for tools, Slack AI, Canvas + Block Kit UI.
3. **Stack:** Slack CLI + Bolt + Claude Agent SDK + Slack MCP Server + RTS API. Start from the official starter agent; don't build from scratch.
4. **Win on the video:** hook in 15s, show it *working*, name-drop RTS+MCP, close on impact. Spend 1.5 days on it.
5. **Target:** Agent for Good 1st ($8k) **+** Best UX ($2k).
6. **Submit July 12**, with sandbox test access granted. Don't wait for the 13th.

---

### Sources
- Slack Agent Builder Challenge — https://slackhack.devpost.com/
- Slack agentic platform overview — https://slack.com/features/agentic-platform
- Slack agent quickstart (CLI/Bolt/Agent SDKs) — https://docs.slack.dev/ai/agent-quickstart/
- Building context-aware agents with MCP Server + RTS — https://slack.dev/context-aware-agents-slack-mcp-server-real-time-search/
- Starter agent (Claude/OpenAI SDK) — https://github.com/slack-samples/bolt-js-starter-agent
- Slack platform / agentic era announcement — https://slack.com/blog/news/powering-agentic-collaboration
- Salesforce newsroom: context-aware AI apps & agents — https://www.salesforce.com/news/stories/slack-context-aware-ai-apps-agents/
