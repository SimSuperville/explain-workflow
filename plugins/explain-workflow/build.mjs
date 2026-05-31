#!/usr/bin/env node
/**
 * build.mjs — assemble a workflow explainer HTML from the bundled template + icon library.
 *
 * Usage:
 *   node build.mjs <data.json> <out.html> [--open]
 *
 * <data.json>  the WF object produced by /explain-workflow (title, summary, stages, nodes, edges)
 * <out.html>   where to write the self-contained explainer
 * --open       open the result in the default browser when done
 *
 * The template (template.html) and the icon library (node-icons.json) are resolved relative to
 * THIS file, so the command only needs one predictable call. No external dependencies.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const open = argv.includes('--open');
const [dataPath, outPath] = argv.filter(a => a !== '--open');

if (!dataPath || !outPath) {
  console.error('Usage: node build.mjs <data.json> <out.html> [--open]');
  process.exit(2);
}

function readText(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch (e) { console.error(`build.mjs: cannot read ${p}: ${e.message}`); process.exit(1); }
}

// 1) Load template + bundled icons (relative to this script) and the caller's workflow data.
const template = readText(path.join(HERE, 'template.html'));
const iconsRaw = readText(path.join(HERE, 'node-icons.json'));

let wf;
try { wf = JSON.parse(readText(dataPath)); }
catch (e) { console.error(`build.mjs: <data.json> is not valid JSON: ${e.message}`); process.exit(1); }
try { JSON.parse(iconsRaw); }
catch (e) { console.error(`build.mjs: node-icons.json is corrupt: ${e.message}`); process.exit(1); }

// 2) Serialize. Escaping "</" -> "<\/" means the data can never close the <script> tag early,
//    no matter what text a node description contains. (Valid inside a JSON string; parses back to "/".)
const safe = s => s.replace(/<\//g, '<\\/');
const dataJson = safe(JSON.stringify(wf));
const iconsJson = safe(iconsRaw);
const titleHtml = String(wf.title || 'Workflow')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 3) Inject. Use replacement *functions* so "$" in the data is never treated as a regex backref.
let html = template;
for (const [token, value] of [
  ['__WORKFLOW_DATA__', dataJson],
  ['__NODE_ICONS__', iconsJson],
  ['__WORKFLOW_TITLE__', titleHtml],
]) {
  if (!html.includes(token)) { console.error(`build.mjs: template is missing ${token}`); process.exit(1); }
  html = html.replace(token, () => value);
}

// 4) Write.
fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
fs.writeFileSync(outPath, html);
console.log(`Wrote ${outPath} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB) — ${wf.nodes?.length ?? 0} nodes, ${wf.edges?.length ?? 0} edges, ${wf.stages?.length ?? 0} stages`);

// 5) Optionally open in the default browser.
if (open) {
  const abs = path.resolve(outPath);
  if (process.platform === 'darwin') execFile('open', [abs], () => {});
  else if (process.platform === 'win32') execFile('cmd', ['/c', 'start', '', abs], () => {});
  else execFile('xdg-open', [abs], () => {});
}
