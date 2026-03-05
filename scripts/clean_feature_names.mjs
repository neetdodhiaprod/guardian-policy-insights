/**
 * Clean feature names across all out/*\/*.json policy files.
 *
 * Cleaning rules (applied in order):
 *  1. Strip everything after ' — ' or ' – ' (em/en-dash with surrounding spaces)
 *     e.g. "Room Rent — At Actuals / No capping" → "Room Rent"
 *  2. Strip verbose trailing ': <sentence>' where the value after ':' is a long
 *     explanation (>25 chars or starts with lowercase/common filler words)
 *     e.g. "Co-pay (base plan): not explicitly stated as 0%" → "Co-pay (base plan)"
 *  3. Remove trailing noise-only parentheticals: (standard), (standard-good),
 *     (unless otherwise…), (may vary), (each and every claim), (base policy),
 *     (all claims), (varies)
 *  4. Collapse multiple spaces, strip trailing punctuation, trim.
 *
 * Run: node scripts/clean_feature_names.mjs [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'out');
const DRY_RUN = process.argv.includes('--dry-run');

// ── Noise-only trailing parentheticals to strip ──────────────────────────────
const NOISE_PARENS = [
  /\s*\(standard(-good|-bad)?\)\s*$/i,
  /\s*\(base policy\)\s*$/i,
  /\s*\(base plan\)\s*$/i,
  /\s*\(unless otherwise specified\)\s*$/i,
  /\s*\(unless specified otherwise\)\s*$/i,
  /\s*\(unless schedule says otherwise\)\s*$/i,
  /\s*\(may vary\)\s*$/i,
  /\s*\(all claims\)\s*$/i,
  /\s*\(varies\)\s*$/i,
  /\s*\(each and every claim\)\s*$/i,
  /\s*\(unless Protect Benefit is in force\)\s*$/i,
  /\s*\(if applicable\)\s*$/i,
  /\s*\(confirm from schedule\)\s*$/i,
];

// Filler prefixes that indicate the colon value is explanatory, not a useful label
const VERBOSE_COLON_STARTERS = [
  'not explicitly', 'not specified', 'not stated', 'not mentioned',
  'not found', 'not clear', 'unclear', 'depends on', 'percentage not',
  'no co-pay', '0%', 'to be confirmed', 'confirm from', 'refer to',
  'as per', 'see policy', 'policy does not', 'wording does not',
  'no information', 'could not', 'cannot', 'n/a',
];

function fixUnclosedParens(str) {
  let depth = 0, lastOpen = -1;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '(') { depth++; lastOpen = i; }
    else if (str[i] === ')') depth--;
  }
  // If unclosed paren, strip from it onwards
  return depth > 0 && lastOpen !== -1 ? str.slice(0, lastOpen).trim() : str;
}

function cleanName(raw) {
  let name = raw;

  // 1. Strip at em-dash / en-dash (with surrounding spaces)
  name = name.replace(/\s+[—–]\s+.*/s, '');

  // 1b. Fix any unclosed parentheses caused by stripping mid-parenthetical
  name = fixUnclosedParens(name);

  // 2. Strip verbose colon suffixes
  const colonIdx = name.lastIndexOf(':');
  if (colonIdx !== -1) {
    const afterColon = name.slice(colonIdx + 1).trim();
    const isVerbose =
      afterColon.length > 25 ||
      VERBOSE_COLON_STARTERS.some((s) => afterColon.toLowerCase().startsWith(s));
    if (isVerbose) {
      name = name.slice(0, colonIdx).trim();
    }
  }

  // 3. Remove noise-only trailing parentheticals
  for (const re of NOISE_PARENS) {
    name = name.replace(re, '');
  }

  // 4. Collapse spaces, strip trailing punctuation, trim
  name = name.replace(/\s{2,}/g, ' ').replace(/[;,.:]\s*$/, '').trim();

  return name;
}

// ── Process all JSON files ────────────────────────────────────────────────────

let totalFiles = 0, totalChanged = 0, totalFeatures = 0, changedFeatures = 0;

for (const insurer of fs.readdirSync(OUT_DIR)) {
  const insurerDir = path.join(OUT_DIR, insurer);
  if (!fs.statSync(insurerDir).isDirectory()) continue;

  for (const file of fs.readdirSync(insurerDir)) {
    if (!file.endsWith('.json')) continue;
    const filePath = path.join(insurerDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    let fileChanged = false;

    for (const bucket of ['great', 'good', 'bad', 'unclear']) {
      const features = data.features?.[bucket] ?? [];
      for (const feat of features) {
        totalFeatures++;
        if (!feat.name) continue;
        const cleaned = cleanName(feat.name);
        if (cleaned !== feat.name) {
          if (DRY_RUN) {
            console.log(`  [${insurer}/${file.replace('.json','')}] ${bucket}`);
            console.log(`    BEFORE: ${feat.name}`);
            console.log(`    AFTER:  ${cleaned}`);
          }
          feat.name = cleaned;
          fileChanged = true;
          changedFeatures++;
        }
      }
    }

    if (fileChanged) {
      totalChanged++;
      if (!DRY_RUN) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      }
    }
    totalFiles++;
  }
}

console.log(`\n${ DRY_RUN ? '[DRY RUN] ' : '' }Processed ${totalFiles} files`);
console.log(`Changed: ${totalChanged} files, ${changedFeatures}/${totalFeatures} features`);
