/**
 * Assemble the final demo video: frames (from capture.mjs) + voiceover clips
 * (from voiceover.py, placed at their timeline offsets) -> docs/video/quiet-hours-demo.mp4
 *
 * Usage:  node tools/video/assemble.mjs [--fps 24]
 * Requires ffmpeg on PATH.
 */

import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const framesDir = path.join(here, 'frames');
const voDir = path.join(here, 'vo');
const outDir = path.join(repo, 'docs', 'video');
const outFile = path.join(outDir, 'quiet-hours-demo.mp4');

const args = process.argv.slice(2);
const fps = Number(args[args.indexOf('--fps') + 1] || 24);

mkdirSync(outDir, { recursive: true });

const timeline = JSON.parse(readFileSync(path.join(voDir, 'timeline.json'), 'utf8'));

// Build ffmpeg args: video from frames + N audio inputs, each delayed to its
// start offset, mixed together.
const ffArgs = ['-y', '-framerate', String(fps), '-i', path.join(framesDir, 'f%05d.jpg')];
for (const clip of timeline) {
  ffArgs.push('-i', path.join(voDir, clip.file));
}

const delays = timeline
  .map((clip, i) => {
    const ms = Math.round(clip.start * 1000);
    return `[${i + 1}:a]adelay=${ms}|${ms},apad[a${i}]`;
  })
  .join(';');
const mixInputs = timeline.map((_, i) => `[a${i}]`).join('');
const filter =
  `${delays};${mixInputs}amix=inputs=${timeline.length}:normalize=0,` +
  `loudnorm=I=-17:TP=-1.5:LRA=11[aout]`;

ffArgs.push(
  '-filter_complex', filter,
  '-map', '0:v', '-map', '[aout]',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k',
  '-shortest',
  '-movflags', '+faststart',
  outFile,
);

console.log('Running ffmpeg assembly…');
execFileSync('ffmpeg', ffArgs, { stdio: 'inherit' });

// Report the result.
const probe = execFileSync('ffprobe', [
  '-v', 'quiet', '-show_entries', 'format=duration,size',
  '-of', 'json', outFile,
]).toString();
const info = JSON.parse(probe).format;
console.log(`\nDone: ${outFile}`);
console.log(`Duration: ${Number(info.duration).toFixed(1)}s · Size: ${(info.size / 1e6).toFixed(1)} MB`);
