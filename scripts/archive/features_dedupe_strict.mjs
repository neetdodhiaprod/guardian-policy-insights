#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

function normName(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/\u00a0/g, ' ')
    .replace(/[^a-z0-9%₹$\s.\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSignals(text) {
  const t = (text ?? '').toLowerCase();
  const nums = [];

  // Currency: ₹10,000 / rs. 10000 / inr 10000
  for (const m of t.matchAll(/(?:₹|rs\.?|inr)\s*([0-9][0-9,]*)/g)) {
    nums.push(`inr:${m[1].replace(/,/g, '')}`);
  }

  // Percent
  for (const m of t.matchAll(/([0-9]+(?:\.[0-9]+)?)\s*%/g)) {
    nums.push(`pct:${m[1]}`);
  }

  // Durations (days/months/years)
  for (const m of t.matchAll(/\b([0-9]{1,4})\s*(day|days|month|months|year|years)\b/g)) {
    nums.push(`dur:${m[1]}:${m[2][0]}`); // d/m/y first letter
  }

  // Plain integers that commonly represent limits (keep conservative)
  for (const m of t.matchAll(/\b([0-9]{2,4})\b/g)) {
    nums.push(`n:${m[1]}`);
  }

  return [...new Set(nums)].sort();
}

function strictKey(r) {
  const nameKey = normName(r.name);
  const sig = extractSignals(`${r.name} ${r.quote} ${r.notes ?? ''}`);
  return [r.type ?? 'unknown', nameKey, sig.join('|')].join('||');
}

async function readJsonl(file) {
  const stream = fs.createReadStream(file, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const out = [];
  for await (const line of rl) {
    const l = line.trim();
    if (!l) continue;
    try { out.push(JSON.parse(l)); } catch {}
  }
  return out;
}

async function main() {
  const inPath = process.argv[2] ?? 'dist/features/all_features_merged.jsonl';
  const outDir = process.argv[3] ?? 'dist/features/dedupe_strict';

  await fsp.mkdir(outDir, { recursive: true });
  const rows = await readJsonl(inPath);

  const groups = new Map();
  for (const r of rows) {
    const k = strictKey(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }

  const groupArr = [];
  for (const [k, items] of groups.entries()) {
    // canonical = first item
    const c = items[0];
    groupArr.push({
      key: k,
      type: c.type ?? 'unknown',
      canonical: {
        pdf: c.pdf,
        name: c.name,
        quote: c.quote,
        page: c.page,
        reference: c.reference ?? null,
      },
      count: items.length,
      occurrences: items.map(it => ({
        pdf: it.pdf,
        clause_id: it.clause_id,
        page: it.page,
        name: it.name,
        quote: it.quote,
      })),
    });
  }

  groupArr.sort((a, b) => b.count - a.count);

  await fsp.writeFile(path.join(outDir, 'groups.json'), JSON.stringify({
    total_features: rows.length,
    total_groups: groupArr.length,
    groups: groupArr,
  }, null, 2));

  // Also write a lightweight canonical list.
  const canonPath = path.join(outDir, 'canonical_features.jsonl');
  const canonStream = fs.createWriteStream(canonPath, { flags: 'w' });
  for (const g of groupArr) {
    canonStream.write(JSON.stringify({
      key: g.key,
      type: g.type,
      count: g.count,
      canonical: g.canonical,
    }) + '\n');
  }
  await new Promise(r => canonStream.end(r));

  console.error(`rows=${rows.length} groups=${groupArr.length}`);
  console.error(`Wrote ${outDir}/groups.json`);
  console.error(`Wrote ${canonPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
