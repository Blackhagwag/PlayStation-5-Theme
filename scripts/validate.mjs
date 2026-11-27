#!/usr/bin/env node
// Developer check (not needed to use the theme): skin.json is valid, every file it
// references exists, every url() in the CSS resolves, and the JavaScript parses.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(process.argv[2] || path.join(path.dirname(new URL(import.meta.url).pathname), '..'));
const errors = [];
const rel = p => path.relative(ROOT, p);

let skin;
try { skin = JSON.parse(fs.readFileSync(path.join(ROOT, 'skin.json'), 'utf8')); }
catch (e) { console.error('skin.json is not valid JSON:', e.message); process.exit(1); }

for (const key of ['name', 'author', 'version', 'description', 'github']) if (!skin[key]) errors.push(`skin.json: missing "${key}"`);
// Millennium ThemeDatabase listing rules
if (!skin.github || !skin.github.owner || !skin.github.repo_name) errors.push('skin.json: github.owner / github.repo_name required for the Millennium store');
for (const k of ['header_image', 'splash_image']) {
  if (!/^https:\/\//.test(skin[k] || '')) { errors.push(`skin.json: ${k} must be an https URL`); continue; }
  const m = /raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/(.+)$/.exec(skin[k]);
  if (m && fs.existsSync(path.join(ROOT, 'assets')) && !fs.existsSync(path.join(ROOT, m[1]))) errors.push(`skin.json: ${k} points to ${m[1]}, which is not in the repository`);
}
if (!/^\d+\.\d+\.\d+$/.test(skin.version || '')) errors.push('skin.json: version must be MAJOR.MINOR.PATCH');

const referenced = new Set();
const add = (file, where) => {
  if (!file) return;
  referenced.add(file);
  if (!fs.existsSync(path.join(ROOT, file))) errors.push(`${where}: missing file ${file}`);
};
const many = (v, where) => (Array.isArray(v) ? v : [v]).forEach(f => add(f, where));
if (skin.RootColors) add(skin.RootColors, 'RootColors');
for (const k of ['webkitCSS', 'Steam-WebKit', 'webkitJS']) if (skin[k]) add(skin[k], k);
for (const p of skin.Patches || []) {
  if (!p.MatchRegexString) errors.push('Patch without MatchRegexString');
  try { new RegExp(p.MatchRegexString); } catch (e) { errors.push(`bad regex ${p.MatchRegexString}`); }
  if (p.TargetCss) many(p.TargetCss, `Patch ${p.MatchRegexString}`);
  if (p.TargetJs) many(p.TargetJs, `Patch ${p.MatchRegexString}`);
}
for (const [name, c] of Object.entries(skin.Conditions || {})) {
  if (c.slider) {
    if (!c.slider.cssVariable) errors.push(`Condition ${name}: slider without cssVariable`);
    continue;
  }
  if (!c.values || !(c.default in c.values)) errors.push(`Condition ${name}: default "${c.default}" is not one of its values`);
  for (const [val, flow] of Object.entries(c.values || {})) {
    for (const t of ['TargetCss', 'TargetJs']) {
      if (!flow[t]) continue;
      if (!Array.isArray(flow[t].affects) || !flow[t].src) errors.push(`Condition ${name}/${val}: ${t} needs affects[] and src`);
      (flow[t].affects || []).forEach(a => { try { new RegExp(a); } catch (e) { errors.push(`Condition ${name}/${val}: bad regex ${a}`); } });
      add(flow[t].src, `Condition ${name}/${val}`);
    }
  }
}

// every url(...) in referenced CSS must exist (remote and data: URLs skipped)
for (const f of referenced) {
  if (!f.endsWith('.css') || !fs.existsSync(path.join(ROOT, f))) continue;
  const css = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
    const u = m[1];
    if (/^(https?:|data:|#)/.test(u)) continue;
    const target = path.resolve(path.dirname(path.join(ROOT, f)), u);
    if (!fs.existsSync(target)) errors.push(`${f}: url(${u}) not found`);
  }
  const open = (css.match(/{/g) || []).length, close = (css.match(/}/g) || []).length;
  if (open !== close) errors.push(`${f}: unbalanced braces (${open} { vs ${close} })`);
}
for (const f of referenced) {
  if (!f.endsWith('.js')) continue;
  try { execFileSync(process.execPath, ['--check', path.join(ROOT, f)], { stdio: 'pipe' }); }
  catch (e) { errors.push(`${f}: syntax error\n${e.stderr}`); }
}

const files = [...referenced].sort();
if (errors.length) { console.error('Validation FAILED:\n - ' + errors.join('\n - ')); process.exit(1); }
console.log(`skin.json OK — version ${skin.version}, ${files.length} referenced files present:`);
files.forEach(f => console.log('  ' + f));
