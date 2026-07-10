/**
 * Frame-by-frame capture of tools/video/film.html via puppeteer-core + the
 * locally installed Chrome. Deterministic: steps window.seekTo(t) at FPS and
 * screenshots each frame, so capture speed doesn't affect the film's timing.
 *
 * Usage:  node tools/video/capture.mjs [--fps 24] [--outdir <framesDir>]
 */

import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const filmPath = path.join(here, 'film.html');

const args = process.argv.slice(2);
const fps = Number(args[args.indexOf('--fps') + 1] || 24);
const outDir =
  args.includes('--outdir')
    ? args[args.indexOf('--outdir') + 1]
    : path.join(here, 'frames');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

if (!existsSync(filmPath)) {
  console.error(`film.html not found at ${filmPath}`);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--window-size=1920,1080', '--hide-scrollbars', '--force-device-scale-factor=1'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(filmPath).href, { waitUntil: 'load' });

  const duration = await page.evaluate(() => window.FILM_DURATION);
  if (!duration || typeof duration !== 'number') {
    throw new Error('film.html did not expose window.FILM_DURATION');
  }
  const totalFrames = Math.ceil(duration * fps);
  console.log(`Capturing ${totalFrames} frames @ ${fps}fps (${duration}s) -> ${outDir}`);

  const started = Date.now();
  for (let f = 0; f < totalFrames; f++) {
    const t = f / fps;
    await page.evaluate((tt) => window.seekTo(tt), t);
    await page.screenshot({
      path: path.join(outDir, `f${String(f).padStart(5, '0')}.jpg`),
      type: 'jpeg',
      quality: 92,
    });
    if (f % (fps * 10) === 0) {
      const pct = ((f / totalFrames) * 100).toFixed(0);
      const rate = f > 0 ? (f / ((Date.now() - started) / 1000)).toFixed(1) : '—';
      console.log(`  frame ${f}/${totalFrames} (${pct}%)  ${rate} fps capture`);
    }
  }
  console.log(`Done: ${totalFrames} frames in ${((Date.now() - started) / 1000).toFixed(0)}s`);
} finally {
  await browser.close();
}
