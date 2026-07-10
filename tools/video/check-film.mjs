// Validation for film.html — run: node tools/video/check-film.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, "film.html"), "utf8");

let failures = [];
function assert(cond, msg) {
  if (cond) { console.log("  PASS  " + msg); }
  else { console.log("  FAIL  " + msg); failures.push(msg); }
}

console.log("== (a) no forbidden dynamic/animation constructs ==");
const forbidden = ["transition:", "@keyframes", "requestAnimationFrame", "setTimeout", "setInterval", "animation:"];
for (const bad of forbidden) {
  const n = src.split(bad).length - 1;
  assert(n === 0, `no "${bad}" present (found ${n})`);
}

console.log("== (b) required API surface ==");
assert(src.includes("window.seekTo"), 'contains window.seekTo');
assert(src.includes("FILM_DURATION"), 'contains FILM_DURATION');
assert(/window\.FILM_DURATION\s*=\s*158/.test(src), 'FILM_DURATION set to 158');

console.log("== (c) 2,300 integrity — only in the Priya bubble ==");
// Total occurrences of the figure in the file.
const total2300 = src.split("2,300").length - 1;
// The Priya scare message is the one carrying the priyaScare flag / priya-msg class.
// In the INCIDENT data the scare line is tagged `priyaScare:1`. Extract that object's text.
const scareMatch = src.match(/priyaScare:1[^}]*t:"([^"]*)"/);
assert(scareMatch !== null, 'found the priyaScare message object');
const scareText = scareMatch ? scareMatch[1] : "";
const in2300 = (scareText.match(/2,300/g) || []).length;
assert(in2300 === 1, `Priya's scare message contains "2,300" exactly once (found ${in2300})`);
assert(total2300 === in2300, `"2,300" appears in the file ONLY inside the Priya bubble text (total=${total2300}, priya=${in2300})`);
// Also confirm the scare message maps to a priya-msg element (class applied when priyaScare set).
assert(/priyaScare\)\s*el\.classList\.add\("priya-msg"\)/.test(src.replace(/\s+/g, " ")) ||
       src.includes('classList.add("priya-msg")'),
       'priyaScare message gets class="priya-msg"');

console.log("== balanced <script> tags ==");
const openScripts = (src.match(/<script\b/g) || []).length;
const closeScripts = (src.match(/<\/script>/g) || []).length;
assert(openScripts === closeScripts, `<script> open (${openScripts}) === close (${closeScripts})`);
const openStyle = (src.match(/<style\b/g) || []).length;
const closeStyle = (src.match(/<\/style>/g) || []).length;
assert(openStyle === closeStyle, `<style> open (${openStyle}) === close (${closeStyle})`);

console.log("");
if (failures.length) {
  console.error(`RESULT: ${failures.length} check(s) FAILED`);
  process.exit(1);
} else {
  console.log("RESULT: ALL CHECKS PASSED");
}
