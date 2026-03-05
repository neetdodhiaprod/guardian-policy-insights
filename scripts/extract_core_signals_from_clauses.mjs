#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

function usage() {
  console.error('Usage: node scripts/extract_core_signals_from_clauses.mjs <clausesJsonl> <outFeaturesJsonl>');
  process.exit(1);
}

function readJsonl(file) {
  return fs
    .readFileSync(file, 'utf8')
    .split(/\n/)
    .filter(Boolean)
    .map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    })
    .filter(Boolean);
}

function clean(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

function snippetAround(text, re, maxLen = 700) {
  const s = String(text ?? '');
  const m = re.exec(s);
  if (!m) return clean(s).slice(0, maxLen);
  const idx = m.index;
  const half = Math.floor(maxLen / 2);
  const start = Math.max(0, idx - half);
  const end = Math.min(s.length, idx + half);
  return clean(s.slice(start, end));
}

function mk(rec, rule) {
  return {
    clause_id: Number(rec.clause_id),
    page: rec.page ?? null,
    type: rule.type,
    name: rule.name,
    quote: snippetAround(rec.text, rule.re, 800),
    reference: rec.reference ?? null,
    notes: 'core_signals_from_clauses_v1'
  };
}

function score(rec, rule) {
  const t = clean(rec.text);
  let s = 0;
  // Prefer clauses that actually contain a number/limit when relevant.
  if (/(\b\d{2,}\b|₹|Rs\.?|INR)/i.test(t)) s += 5;
  // Prefer shorter, tighter clauses.
  s -= Math.min(20, Math.floor(t.length / 400));
  // Prefer having a reference.
  if (rec.reference) s += 2;
  // Penalize table-y noise.
  if (t.split(/\n/).length > 10) s -= 4;
  // Ensure match exists.
  if (!rule.re.test(t)) return -9999;
  return s;
}

const RULES = [
  { key: 'initial_wait', type: 'waiting_period', name: '30-day initial waiting period', re: /within\s+30\s+days|30\s+days\s+from\s+the\s+first\s+policy\s+commencement/i },
  { key: 'ped_wait', type: 'waiting_period', name: 'PED waiting period', re: /pre\s*-?\s*existing[\s\S]{0,200}?\b(24|36|48|60)\s*months\b|\b(24|36|48|60)\s*months\b[\s\S]{0,200}?pre\s*-?\s*existing/i },
  { key: 'spec_wait', type: 'waiting_period', name: 'Specified illness/procedure waiting period', re: /specified\s+disease|listed\s+conditions|surgeries\/treatments|procedures?[\s\S]{0,120}?\b(12|24|36)\s*months\b/i },

  { key: 'room_rent', type: 'room_rent', name: 'Room rent (default term)', re: /1\.1\.a\s*room\s*rent[\s\S]{0,120}at\s+actuals|room\s*rent\s+at\s+actuals|single\s+private\s+room/i },
  { key: 'prop_ded', type: 'payout_reducer', name: 'Proportionate deduction', re: /proportionate\s+deduction(?![\s\S]{0,60}not\s+(be\s+)?applicable)/i },
  { key: 'pre_window', type: 'pre_post', name: 'Pre-hospitalization window', re: /pre\s*-\s*hospitalization[\s\S]{0,80}?(\b\d{1,3}\b)\s*days/i },
  { key: 'post_window', type: 'pre_post', name: 'Post-hospitalization window', re: /post\s*-\s*hospitalization[\s\S]{0,80}?(\b\d{1,3}\b)\s*days/i },

  { key: 'secure', type: 'benefit', name: 'Secure Benefit', re: /\bsecure\s+benefit\b/i },
  { key: 'plus', type: 'benefit', name: 'Plus Benefit', re: /\bplus\s+benefit\b/i },
  { key: 'restore', type: 'benefit', name: 'Automatic Restore / Restore Benefit', re: /automatic\s+restore\s+benefit|restore\s+benefit|instantly\s+add\s+100%/i },
  { key: 'non_med', type: 'benefit', name: 'Non-medical / consumables cover', re: /non-?medical\s+expenses|annexure\s+b|consumables/i },

  { key: 'copay_rule', type: 'cost_share', name: 'Co-pay rule', re: /co-?pay(?:ment)?[\s\S]{0,120}?(applicable|shall|deducted|borne)/i },
  { key: 'deductible_rule', type: 'cost_share', name: 'Deductible rule', re: /(aggregate\s+deductible|\bdeductible\b)[\s\S]{0,120}?(applicable|shall|borne)/i },

  { key: 'sublimit', type: 'sublimit', name: 'Disease-wise / procedure-wise sublimit', re: /(cataract|hernia|knee|angioplasty|stent|chemotherapy|radiotherapy)[\s\S]{0,120}?(sub-?limit|sublimit|limited\s+to|up\s+to|maximum)/i },

  { key: 'air_amb', type: 'benefit', name: 'Air ambulance', re: /air\s+ambulance/i },
  { key: 'domic', type: 'benefit', name: 'Domiciliary hospitalization', re: /domiciliary\s+hospitalization/i },
  { key: 'bari', type: 'benefit', name: 'Bariatric surgery', re: /bariatric/i }
];

async function main() {
  const [inPath, outPath] = process.argv.slice(2);
  if (!inPath || !outPath) usage();
  await fsp.mkdir(path.dirname(outPath), { recursive: true });

  const clauses = readJsonl(inPath);

  const bestByKey = new Map(); // key -> { rec, score }

  for (const c of clauses) {
    const text = String(c.text ?? '');
    if (!text || text.length < 80) continue;

    for (const rule of RULES) {
      if (!rule.re.test(text)) continue;
      const sc = score(c, rule);
      const prev = bestByKey.get(rule.key);
      if (!prev || sc > prev.score) bestByKey.set(rule.key, { rec: c, score: sc, rule });
    }
  }

  const out = [];
  for (const rule of RULES) {
    const best = bestByKey.get(rule.key);
    if (!best) continue; // per your rule: if not found, do not show
    out.push(mk(best.rec, rule));
  }

  const lines = out.map((r) => JSON.stringify(r));
  await fsp.writeFile(outPath, lines.join('\n') + (lines.length ? '\n' : ''), 'utf8');
  console.error(`Wrote ${outPath} (${out.length} core signals)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
