// CI checks for the PARSEC extension (no dependencies).
//
//   node .github/scripts/check-extension.mjs manifest PARSEC
//     manifest.json parses, has the required keys and every file it
//     (or newtab.html / popup.html) references exists.
//
//   node .github/scripts/check-extension.mjs lint lint.json
//     Evaluates `web-ext lint --output json`: errors fail, warnings don't.
//     web-ext targets Firefox, so the Firefox-only errors a Chrome MV3
//     manifest always triggers are reported but not counted.

import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';

const [mode, target] = process.argv.slice(2);
const problems = [];

if (mode === 'manifest') {
  const dir = target;
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  } catch (err) {
    console.error(`manifest.json: ${err.message}`);
    process.exit(1);
  }

  for (const key of ['manifest_version', 'name', 'version', 'description', 'icons']) {
    if (manifest[key] === undefined) problems.push(`missing required key "${key}"`);
  }
  if (manifest.manifest_version !== 3) problems.push(`manifest_version must be 3, got ${manifest.manifest_version}`);
  if (manifest.version && !/^\d+(\.\d+){0,3}$/.test(manifest.version)) {
    problems.push(`version "${manifest.version}" is not 1-4 dot-separated integers`);
  }

  const files = new Set([
    ...Object.values(manifest.icons ?? {}),
    ...Object.values(manifest.action?.default_icon ?? {}),
    ...Object.values(manifest.chrome_url_overrides ?? {}),
    manifest.background?.service_worker,
    manifest.action?.default_popup,
    manifest.options_page,
    manifest.options_ui?.page,
    ...(manifest.content_scripts ?? []).flatMap(cs => [...(cs.js ?? []), ...(cs.css ?? [])]),
  ].filter(Boolean));

  // local <script src> / <link href> in referenced HTML pages
  for (const file of [...files]) {
    if (!file.endsWith('.html') || !existsSync(join(dir, file))) continue;
    const html = readFileSync(join(dir, file), 'utf8');
    for (const [, ref] of html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
      if (/^(?:[a-z]+:|\/\/|#|data:)/i.test(ref)) continue;
      files.add(posix.normalize(posix.join(posix.dirname(file), ref.split(/[?#]/)[0])));
    }
  }

  for (const file of files) {
    if (!existsSync(join(dir, file))) problems.push(`referenced file not found: ${file}`);
  }
  console.log(`manifest.json: ${files.size} referenced files checked`);
} else if (mode === 'lint') {
  const FIREFOX_ONLY = new Set([
    'ADDON_ID_REQUIRED',                     // browser_specific_settings.gecko.id
    'BACKGROUND_SERVICE_WORKER_NOFALLBACK',  // Firefox needs background.scripts
  ]);
  const report = JSON.parse(readFileSync(target, 'utf8'));
  const fmt = m => `${m.code} ${m.file ?? ''}${m.line ? ':' + m.line : ''} – ${m.message}`;
  for (const m of report.warnings ?? []) console.log(`warning: ${fmt(m)}`);
  for (const m of report.errors ?? []) {
    if (FIREFOX_ONLY.has(m.code)) console.log(`ignored (Firefox-only): ${fmt(m)}`);
    else problems.push(fmt(m));
  }
  console.log(`web-ext lint: ${report.summary.errors} errors, ${report.summary.warnings} warnings, ${report.summary.notices} notices`);
} else {
  console.error('usage: check-extension.mjs manifest <dir> | lint <report.json>');
  process.exit(2);
}

for (const p of problems) console.error(`::error::${p}`);
process.exit(problems.length ? 1 : 0);
