# Quiet Hours — Demo Runbook & Shot List

This is the exact sequence for the 3-minute demo video **and** the click-through
judges will run in the sandbox. The incident is fully scripted and deterministic:
the "1:47am, one person alone" trigger fires the same way every time, and no one
has to wait three real hours for it.

**The story:** *Meals on Rails*, a small food-bank logistics nonprofit. Their
delivery-routing service starts failing at 22:40 the night before a big delivery
day. A single volunteer, **Priya**, firefights it alone from 22:40 past 01:47.
A monitoring bot spams route-solver alerts the whole time. Her backup **Marcus**
is asleep.

> **Integrity note for judges (and for us on camera):** the "2,300 meals" figure
> appears **only inside Priya's own typed dialogue** as her worry
> ("if routing's still down at 6am we can't dispatch the 2,300 meals"). The agent
> **never** computes, claims, or reports that number. Everything the agent
> reports is something it observed in Slack: message counts, solo minutes, and
> silenced pings. Do not let any slide, caption, or voiceover present 2,300 as an
> agent metric.

---

## Before you hit record

1. App is running in Socket Mode and installed in the demo workspace.
2. You are in a channel the app can post to — call it **#meals-on-rails-oncall**.
3. Run `/quiethours watch` once in that channel so it is being watched.
4. Make sure you (the on-call user) have a DM open with the app so the 1:47am
   nudge is easy to cut to.

---

## The beats

### Beat 1 — Seed the incident

**Do:** In #meals-on-rails-oncall, run:

```
/quiethours demo
```

**What happens on screen:** `seedDemo()` posts the full 40-message overnight
timeline into the channel, fast (about one line every third of a second). Each
line is prefixed with its simulated time — `[22:40]`, `[23:26]`, `[01:47]` — so
it reads as a real night compressed into ~15 seconds. You see:

- monitor-bot firing `⚠️ ROUTE_SOLVER timeout` alerts (these become the
  "pings silenced" count),
- Priya's debugging arc: notices errors → tails logs → restarts the pod → it
  fails again → traces it to a bad `routing-config v2.3.0` deploy at 22:40 →
  rolls back → finally stable, exhausted, worried about the morning.

**Camera:** Full channel view, scrolling. Let the timestamps and the rising
frustration land. Linger a half-second on the `[01:47] still the only one here`
line at the bottom.

### Beat 2 — The 1:47am DM appears

**Do:** Nothing — after seeding, the demo command forces a detection pass using
`buildHeuristicContextFromScript()` (localHour = 1, soloMinutes ≈ 185, 32 solo
messages). The heuristic triggers and the app DMs Priya.

**What happens on screen:** A private DM from Quiet Hours slides in. It is gentle,
not alarmist — it reflects back only what it observed: how long she's been solo,
how many messages, how many alerts it can silence for her — and offers to help her
hand off and rest. Buttons: **Hand off & sleep**, **Keep going**, **Snooze**.

**Camera:** Cut to the DM. Frame it tight so the copy is readable. This is the
emotional turn of the video — hold on it. Optional voiceover: "At 1:47am, Quiet
Hours noticed Priya was still alone."

### Beat 3 — Press "Hand off & sleep"

**Do:** Click **Hand off & sleep** in the DM.

**What happens on screen:** The app drafts a handoff note from the incident
(root cause: bad `v2.3.0` deploy, fix: rollback + osrm restart, do-not-touch),
posts it, and silences the pending alerts for the night.

**Camera:** Show the cursor clicking the button, then the drafted handoff note
appearing. Frame both the button press and the result in one continuous shot if
you can.

### Beat 4 — PagerDuty pages Marcus

**Do:** Nothing — the handoff action pages the backup.

**What happens on screen:** A PagerDuty page fires to **Marcus** (the sleeping
backup). Show the PagerDuty notification / incident so it's clear a real,
external handoff happened — Priya is no longer the only line of defense.

**Camera:** Cut to the PagerDuty incident view or the phone push. Keep it brief —
two seconds is enough to prove it's real.

### Beat 5 — Morning: `/quiethours morning`

**Do:** Run:

```
/quiethours morning
```

**What happens on screen:** The app posts the **morning Canvas** — the calm,
end-of-story artifact. It summarizes the night in the agent's own observed terms:
solo minutes, messages Priya sent alone, alerts silenced, when the handoff
happened, and who got paged. This is the "and everyone rested" payoff.

**Camera:** Full Canvas. Slow scroll top to bottom. End the video here on the
Canvas. Optional closing line: "Priya slept. The meals still went out."

---

## Fallbacks (in case the sandbox is flaky)

- If the bot **username override** isn't permitted in the workspace, `seedDemo`
  automatically re-posts bot lines as plain `🤖 monitor-bot: …` text. The demo
  still reads correctly — no action needed.
- If postMessage hits a rate limit, the built-in ~350ms pacing between messages
  should prevent it; if you still see throttling, just re-run `/quiethours demo`
  in a fresh channel.
- Detection is not time-dependent: `buildHeuristicContextFromScript()` pins
  `now` to the scripted 01:47 and `localHour` to 1, so the trigger fires
  regardless of the real wall-clock time when you record.

---

## One-line summary of the flow

`/quiethours demo` (seed + trigger) → **1:47am DM** → **Hand off & sleep** →
**PagerDuty pages Marcus** → `/quiethours morning` → **the Canvas**.
