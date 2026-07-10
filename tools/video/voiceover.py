"""Generate the Quiet Hours demo voiceover with edge-tts.

One MP3 per beat (placed at its start offset during assembly). Voice is a warm,
natural neural voice; rate slightly slowed for the closing lines.

Usage:  python tools/video/voiceover.py  (from repo root)
Output: tools/video/vo/beat01.mp3 ... beat10.mp3 + timeline.json
"""

import asyncio
import json
import subprocess
from pathlib import Path

import edge_tts

VOICE = "en-US-AndrewMultilingualNeural"

# (start_seconds, window_seconds, rate, text) — exact words from VIDEO_SCRIPT.md
BEATS = [
    (0.5, 10.5, "-4%",
     "It's 1:47 in the morning, and Priya has been fighting this outage alone "
     "for three hours — and nobody at her nonprofit knows."),
    (11.5, 22.5, "+2%",
     "This is a real night, compressed. A routing service breaks the evening "
     "before a big delivery. One volunteer, Priya, works it alone — while a "
     "monitoring bot fires alert after alert, and her backup, Marcus, sleeps."),
    (34.5, 6.5, "-2%",
     "The stakes are hers alone to carry."),
    (41.5, 14.5, "+0%",
     "At 1:47 a.m., Quiet Hours noticed. It didn't diagnose her, or nag her. "
     "It reflected back only what it had seen — and made her an offer."),
    (56.5, 13.5, "+0%",
     "Every number here is real — solo time, messages, the silence. And at the "
     "bottom, a promise: nothing on this page is estimated or invented."),
    (70.5, 14.5, "+4%",
     "Under the hood: the Real-Time Search API reads the live channel and "
     "detects one person alone. An MCP server pages a rested backup through "
     "real PagerDuty. And Slack AI drafts the handoff note and the morning Canvas."),
    (85.5, 14.5, "+0%",
     "She taps one button. Quiet Hours pages her backup, posts the handoff, "
     "and silences the alerts for the night."),
    (100.5, 14.5, "+2%",
     "The note is drafted from what actually happened — the bad deploy, the "
     "rollback, the do-not-touch. And this page is real: Marcus gets woken so "
     "Priya doesn't have to be the only line of defense."),
    (115.5, 29.5, "-2%",
     "In the morning, the team opens a Canvas. Not a postmortem that blames — "
     "a record that sees. Solo hours. Messages sent alone. Alerts held quiet. "
     "Who got paged, and when. Every line observed. Nothing invented."),
    (146.0, 11.0, "-6%",
     "Every incident tool optimizes for the service. Quiet Hours optimizes for "
     "the human."),
]

OUT = Path(__file__).parent / "vo"


def probe_duration(path: Path) -> float:
    """Return audio duration in seconds via ffprobe."""
    out = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(path)],
        capture_output=True, text=True,
    )
    return float(out.stdout.strip())


async def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    timeline = []
    for i, (start, window, rate, text) in enumerate(BEATS, 1):
        dest = OUT / f"beat{i:02d}.mp3"
        await edge_tts.Communicate(text, VOICE, rate=rate).save(str(dest))
        dur = probe_duration(dest)
        fit = "OK" if dur <= window else f"OVERFLOW by {dur - window:.1f}s"
        print(f"beat{i:02d}  start={start:6.1f}s  window={window:4.1f}s  "
              f"audio={dur:5.2f}s  {fit}")
        timeline.append({"beat": i, "start": start, "window": window,
                         "duration": dur, "file": dest.name, "fit": fit})
    (OUT / "timeline.json").write_text(json.dumps(timeline, indent=2))
    print(f"\nWrote {len(BEATS)} clips + timeline.json to {OUT}")


if __name__ == "__main__":
    asyncio.run(main())
