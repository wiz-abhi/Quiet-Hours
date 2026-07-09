# Quiet Hours — Demo Video Production Script

**Track:** Agent for Good · **Target runtime:** 2:35–2:50 · **Aspect:** 16:9, 1080p

**Integrity rule (read before recording):** the video may show **only numbers the
agent actually observed** — solo minutes, message counts, silenced pings, handoff
time, who got paged. The **2,300-meals** figure appears **once, only as Priya's
typed Slack message**, never as an agent metric, caption, slide, or voiceover claim.
Everything else on screen is a real string from `src/ui/copy.js`, `dmBlocks.js`, or
`canvas.js`.

---

## Timed shot table

| Start–End | On-screen visual | Voiceover (exact words) | Camera / edit notes |
|---|---|---|---|
| **0:00–0:11** | Black, then slow fade into the `#meals-on-rails-oncall` channel scrolled to `[01:47] still the only one here`. Single desk lamp vibe. | "It's 1:47 in the morning, and Priya has been fighting this outage alone for three hours — and nobody at her nonprofit knows." | Cold open. No music yet — let the line breathe. Cut in a soft ambient pad on "nobody." Dim the room; screen is the only light source. |
| **0:11–0:34** | `/quiethours demo` seeds the overnight timeline — messages fly in fast, each prefixed `[22:40]`, `[23:26]`, `[00:46]`, `[01:47]`. Show `⚠️ ALERT: ROUTE_SOLVER timeout` bot lines and Priya's arc. Linger 0.5s on `marcus is asleep, of course... i'm on my own with this one`. | "This is a real night, compressed. A routing service breaks the evening before a big delivery. One volunteer, Priya, works it alone — while a monitoring bot fires alert after alert, and her backup, Marcus, sleeps." | Fast auto-scroll (speed-ramp the 40 lines to ~15s). Hold the "on my own" line. Music enters low. Timestamps must stay legible — don't over-crop. |
| **0:34–0:41** | Freeze-frame on Priya's typed worry: `if routing's still down at 6am we can't dispatch the 2,300 meals tomorrow. people are counting on those`. Subtle highlight box around **her message bubble only**. | "The stakes are hers alone to carry." | This is the ONLY place 2,300 appears — it is Priya's message, in her bubble, with her avatar. No caption or graphic repeats the number. Do not narrate "2,300." |
| **0:41–0:56** | Cut to the private DM from **Quiet Hours** sliding in. Frame tight and readable. Header: **You've been on this alone for 3h 5m 🌙**. Body: *"It's 3h 5m into this and it looks like it's still just you. That's a lot to hold by yourself. No pressure at all — but if you'd like, I can page your backup and write the handoff note for you so you can actually sleep."* | "At 1:47 a.m., Quiet Hours noticed. It didn't diagnose her, or nag her. It reflected back only what it had seen — and made her an offer." | The emotional turn. Slow push-in (~4%). Hold long enough to read the body. Music swells gently here. |
| **0:56–1:10** | Same DM, pan down to the observed fields and buttons. Fields: **Solo so far · 3h 5m**, **Messages you sent · 32 messages**, **Quietest stretch · no one else has replied in 3h 5m**, **Your local time · 01:00**. Footer: *"Every number on this page was observed in Slack — nothing here is estimated or invented."* Buttons: **Hand off & sleep · Snooze 30 min · I'm okay, keep going**. | "Every number here is real — solo time, messages, the silence. And at the bottom, a promise: nothing on this page is estimated or invented." | Highlight the footer line for ~1.5s. This footer is the honesty thesis — give it a beat. Keep buttons in frame at the end of this shot. |
| **1:10–1:25** | ~15s architecture beat. Three-node diagram animates in over a dimmed Slack backdrop. Node 1: **Real-Time Search API → detection**. Node 2: **MCP server → PagerDuty handoff**. Node 3: **Slack AI → drafts handoff + Canvas**. Arrows flow left→right into Slack. | "Under the hood: the Real-Time Search API reads the live channel and detects one person alone. An MCP server pages a rested backup through real PagerDuty. And Slack AI drafts the handoff note and the morning Canvas." | Name each system ON SCREEN as it's spoken, synced to the voiceover. Keep it clean and fast — 15s, three labels, done. Return to Slack immediately after. |
| **1:25–1:40** | Back in the DM. Cursor clicks **Hand off & sleep** (primary button). Confirmation replaces the buttons: *"Done. I've paged Marcus and posted your handoff note. 🌙 You're off the hook — go get some rest. We've got it from here."* | "She taps one button. Quiet Hours pages her backup, posts the handoff, and silences the alerts for the night." | Show the actual click (cursor + button depress). One continuous shot from click to confirmation if possible. Warm beat on "We've got it from here." |
| **1:40–1:52** | Cut to the drafted handoff note posted in-channel — root cause `routing-config v2.3.0` deploy at 22:40, fix rollback to `v2.2.4` + osrm restart, `do NOT re-deploy`. Then a fast cut to the **PagerDuty** incident view / phone push paging **Marcus**. | "The note is drafted from what actually happened — the bad deploy, the rollback, the do-not-touch. And this page is real: Marcus gets woken so Priya doesn't have to be the only line of defense." | Keep PagerDuty on screen ~2s — just enough to prove it's a real external handoff. Show the incident title or push banner clearly. |
| **1:52–2:22** | `/quiethours morning` posts the **Canvas**. Slow scroll top→bottom. Title: **What Priya carried last night**. Intro: *"Last night one of us was on call alone into the small hours..."* Timeline (`01:47 → paged Marcus → handed off and resolved`), **By the numbers** (Solo time, Messages sent, Pings held quiet, Backup paged at Marcus), Handoff note excerpt, and footer: *"Every number on this page was observed in Slack — nothing here is estimated or invented."* | "In the morning, the team opens a Canvas. Not a postmortem that blames — a record that sees. Solo hours. Messages sent alone. Alerts held quiet. Who got paged, and when. Every line observed. Nothing invented." | Smooth slow scroll — let each section register. This is the payoff artifact. Music resolves warm. Land the scroll on the honesty footer. |
| **2:22–2:38** | Slow fade from the Canvas to a soft dark card. **Quiet Hours** wordmark + moon 🌙. Beat of quiet. | "Every incident tool optimizes for the service. Quiet Hours optimizes for the human." | Music breathes out under the final line. Hold the card ~2s after the last word. Fade to black. End. |

**Total: ~2:38.** If you need to trim to 2:35, tighten the seed scroll (0:11–0:34) by 3s.

---

## Captions (accessibility — one per beat, burned-in or SRT)

- **0:00** — "It's 1:47 in the morning, and Priya has been fighting this outage alone for three hours — and nobody at her nonprofit knows."
- **0:11** — "A real overnight incident, compressed: one volunteer, a broken routing service, a sleeping backup."
- **0:34** — "Priya's own message: the stakes she's carrying alone." *(the 2,300 figure is visible only in her Slack bubble)*
- **0:41** — "Quiet Hours DMs her — reflecting only what it observed, and offering to help."
- **0:56** — "Observed facts only: solo time, messages, silence. Footer: nothing here is estimated or invented."
- **1:10** — "How it works: Real-Time Search API detects · MCP server pages PagerDuty · Slack AI drafts the note and Canvas."
- **1:25** — "One tap: Hand off & sleep. Backup paged, handoff posted, alerts silenced."
- **1:40** — "Handoff drafted from the real incident. A real PagerDuty page wakes Marcus."
- **1:52** — "Morning Canvas: the night made visible, in the agent's own observed terms."
- **2:22** — "Every incident tool optimizes for the service. Quiet Hours optimizes for the human."

---

## B-roll / asset list

- Full `#meals-on-rails-oncall` channel scroll (the 40-line seed) — capture clean, one take.
- Tight crop of the intervention DM: header, body, four fields, three buttons, footer.
- Cursor-click capture on **Hand off & sleep** → confirmation swap.
- In-channel drafted handoff note (root cause / fix / do-not-touch).
- PagerDuty incident view **and** a phone push notification (shoot both; pick the clearer).
- Full morning Canvas scroll, top to bottom.
- Freeze-frame of Priya's `2,300 meals` message bubble (isolated, for the 0:34 beat).
- Ambient: dark room + single desk lamp establishing shot (2–3s, optional cold-open texture).
- Architecture diagram (build as an overlay: 3 labeled nodes → arrows → Slack).

---

## Thumbnail suggestion

Dark frame, single warm lamp glow. The intervention DM header **"You've been on this
alone for 3h 5m 🌙"** large and legible, with a soft-focus Slack channel behind it.
Bottom-corner tag: **Quiet Hours — an agent that pages your backup so you can sleep.**
High contrast, one focal line, moon emoji as the only bright accent.

---

## Recording checklist

**OBS / capture**
- 1920×1080, 60fps capture (export 30fps is fine), CRF 18–20, MP4/H.264.
- Display capture of the Slack window only — crop out the OS taskbar and clock.
- Disable notifications system-wide (Focus/Do Not Disturb) so no external toasts intrude.
- Record system audio muted; lay voiceover + music in post.

**Slack**
- Zoom the Slack UI to **125–150%** (View → Zoom In) so DM copy and Canvas text are readable at 1080p.
- Use a clean workspace theme (default/light or a single dark theme — be consistent).
- Pre-open the DM with the Quiet Hours app so the 1:47 nudge is one cut away.
- Run `/quiethours watch` in the channel before recording (per the runbook).

**What to hide**
- Real names, other channels, unread badges, and the workspace sidebar clutter — collapse or crop.
- Any real email addresses / member avatars that aren't Priya, Marcus, monitor-bot, or Quiet Hours.
- The real wall-clock time (detection is pinned to 01:47 by `buildHeuristicContextFromScript()`, so the OS clock is irrelevant and should be cropped out).
- DevTools, terminals, and the seeding lag — speed-ramp the seed scroll in the edit.

**Continuity**
- Field values shown must match the scripted run: **Solo so far 3h 5m**, **Messages you sent 32 messages**, **Your local time 01:00**. If a live run differs, recapture rather than caption over it.
