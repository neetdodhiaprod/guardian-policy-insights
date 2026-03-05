#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

function usage() {
  console.error('Usage: node scripts/extract_core_features_from_clauses.mjs <clausesJsonl> <outFeaturesJsonl>');
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
  return String(s ?? '').trim();
}

function mk(rec, type, name) {
  return {
    clause_id: Number(rec.clause_id),
    page: rec.page ?? null,
    type,
    name,
    quote: clean(rec.text),
    reference: rec.reference ?? null,
    notes: 'core_extractor_from_clauses_v1'
  };
}

const RULES = [
  { type: 'waiting_period', name: '30-day initial waiting period', re: /within\s+30\s+days|30\s+days\s+from\s+the\s+first\s+policy\s+commencement/i },
  { type: 'waiting_period', name: 'PED waiting period', re: /pre\s*-?\s*existing.*\b(24|36|48|60)\s*months\b|\b(24|36|48|60)\s*months\b.*pre\s*-?\s*existing/i },
  { type: 'waiting_period', name: 'Specified illness/procedure waiting period', re: /specified\s+disease|listed\s+conditions|procedures?\b.*\b(12|24|36)\s*months\b/i },

  { type: 'room_rent', name: 'Room rent / accommodation category rule', re: /room\s*rent|single\s+private\s+room|any\s+room|shared\s+room|accommodation\s+category/i },
  { type: 'payout_reducer', name: 'Proportionate deduction', re: /proportionate\s+deduction/i },

  { type: 'pre_post', name: 'Pre-hospitalization window', re: /pre\s*-\s*hospitalization|pre\s*-\s*hospitalisation/i },
  { type: 'pre_post', name: 'Post-hospitalization window', re: /post\s*-\s*hospitalization|post\s*-\s*hospitalisation/i },

  { type: 'benefit', name: 'Restore / Reinstatement', re: /restore\s+benefit|reinstat|instantly\s+add\s+100%/i },
  { type: 'benefit', name: 'Secure Benefit', re: /secure\s+benefit/i },
  { type: 'benefit', name: 'Plus Benefit', re: /plus\s+benefit/i },
  { type: 'benefit', name: 'Protect Benefit / non-medical expenses', re: /protect\s+benefit|non-?medical\s+expenses|annexure\s+b/i },

  { type: 'cost_share', name: 'Co-pay', re: /co-?payment|co-?pay/i },
  { type: 'cost_share', name: 'Deductible', re: /aggregate\s+deductible|\bdeductible\b/i },

  { type: 'sublimit', name: 'Disease-wise sublimits', re: /sub-?limit|sublimit/i },
  { type: 'benefit', name: 'Air ambulance', re: /air\s+ambulance/i },
  { type: 'benefit', name: 'Domiciliary hospitalization', re: /domiciliary\s+hospitalization/i },
  { type: 'benefit', name: 'Bariatric surgery', re: /bariatric/i }
];

async function main() {
  const [inPath, outPath] = process.argv.slice(2);
  if (!inPath || !outPath) usage();
  await fsp.mkdir(path.dirname(outPath), { recursive: true });

  const clauses = readJsonl(inPath);
  const out = [];
  const seen = new Set();

  for (const c of clauses) {
    const text = clean(c.text);
    if (!text || text.length < 60) continue;

    for (const rule of RULES) {
      if (!rule.re.test(text)) continue;
      const r = mk(c, rule.type, rule.name);
      const k = `${r.type}||${r.name}||${r.quote}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
  }

  // Write JSONL
  const lines = out.map((r) => JSON.stringify(r));
  await fsp.writeFile(outPath, lines.join('\n') + (lines.length ? '\n' : ''), 'utf8');
  console.error(`Wrote ${outPath} (${out.length} core feature hits)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
