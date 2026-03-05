/**
 * Post-processing: enforce co-pay rule across all out/ JSON files.
 *
 * Rule:
 *   - If a co-pay feature exists in GOOD/UNCLEAR and has a quote → move to BAD
 *   - If a co-pay feature exists in GOOD/UNCLEAR and has NO quote → also move to BAD
 *     (the AI found it, so it was mentioned somewhere)
 *   - Co-pay in GREAT stays in GREAT only if explanation says "no co-pay" (those are correct)
 *
 * Run: node scripts/fix_copay.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'out');

let totalFixed = 0;

for (const insurer of fs.readdirSync(OUT_DIR).sort()) {
  const insurerDir = path.join(OUT_DIR, insurer);
  if (!fs.statSync(insurerDir).isDirectory()) continue;

  for (const file of fs.readdirSync(insurerDir).sort()) {
    if (!file.endsWith('.json')) continue;
    const filePath = path.join(insurerDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let changed = false;

    for (const fromBucket of ['great', 'good', 'unclear']) {
      const features = data.features?.[fromBucket] ?? [];
      const toMove = [];
      const toKeep = [];

      for (const f of features) {
        const isCoPayEntry =
          f.name?.toLowerCase().includes('co-pay') ||
          f.name?.toLowerCase().includes('copay') ||
          f.name?.toLowerCase().includes('co pay');

        if (!isCoPayEntry) {
          toKeep.push(f);
          continue;
        }

        // If in GREAT and explanation clearly says no co-pay → keep
        if (fromBucket === 'great') {
          const exp = (f.explanation ?? '').toLowerCase();
          if (exp.includes('no co-pay') || exp.includes('no copay') || exp.includes('zero co-pay') || exp.includes('not charged')) {
            toKeep.push(f);
            continue;
          }
        }

        // Otherwise, move to BAD — the AI found a co-pay entry, so it's a red flag
        toMove.push(f);
      }

      if (toMove.length > 0) {
        data.features[fromBucket] = toKeep;
        data.features.bad = [...(data.features.bad ?? []), ...toMove];
        totalFixed += toMove.length;
        changed = true;
        console.log(`  [${insurer}/${file.replace('.json', '')}] moved ${toMove.length} co-pay entry from ${fromBucket} → bad`);
      }
    }

    if (changed) {
      // Recompute summary
      data.summary = {
        great:   data.features.great?.length ?? 0,
        good:    data.features.good?.length ?? 0,
        bad:     data.features.bad?.length ?? 0,
        unclear: data.features.unclear?.length ?? 0,
      };
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    }
  }
}

console.log(`\nFixed ${totalFixed} co-pay entries → moved to BAD.`);
