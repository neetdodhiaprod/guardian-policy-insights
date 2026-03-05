#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

function usage() {
  console.error('Usage: node scripts/grade_pdf_features_rules.mjs <featuresJsonl> <outJsonPath>');
  process.exit(1);
}

function readJsonl(file) {
  const lines = fs.readFileSync(file, 'utf8').split(/\n/).filter(Boolean);
  return lines.map((l) => JSON.parse(l));
}

function norm(s) {
  return String(s ?? '').toLowerCase();
}

function pickTop(items, max, preferRegexes = []) {
  const scored = items.map((it) => {
    const text = `${it.name}\n${it.quote}\n${it.type}`;
    let score = 0;
    for (let i = 0; i < preferRegexes.length; i++) {
      if (preferRegexes[i].test(text)) score += (preferRegexes.length - i) * 10;
    }
    // Prefer having a reference and longer quotes.
    if (it.reference) score += 2;
    score += Math.min(5, Math.floor((it.quote?.length ?? 0) / 200));
    return { it, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, max).map((x) => x.it);
}

function toOutItem(it, explanation) {
  return {
    name: it.name,
    quote: it.quote,
    reference: it.reference ?? 'Not provided',
    explanation,
  };
}

function explain(kind, it) {
  // Keep it short and customer-friendly.
  switch (kind) {
    case 'GREAT':
      return `What this means for you: This is a strong benefit that can meaningfully increase your usable coverage. When it applies: As per the clause wording in the policy.`;
    case 'BAD':
      return `What this means for you: This can reduce your claim payout or increase out-of-pocket costs in a surprising way. When it applies: In the scenario described in the clause.`;
    case 'GOOD':
      return `What this means for you: This is a standard/expected rule or a reasonable condition to be aware of. When it applies: In the situation described in the clause.`;
    case 'UNCLEAR':
      return `What this means for you: The wording is ambiguous or discretionary, so the real-world outcome is hard to predict. When it applies: When the insurer applies discretion / interpretation.`;
    default:
      return `What this means for you: See clause. When it applies: See clause.`;
  }
}

function classify(it) {
  const t = norm(it.type);
  const n = norm(it.name);
  const q = norm(it.quote);
  const text = `${n}\n${q}\n${t}`;

  // BAD (claim-shock red flags) — keep this very strict.
  // Note: handle "not applicable" first so we don't misclassify exemptions.
  if (/proportionate\s+deduction/.test(text) && /not\s+(be\s+)?applicable/.test(text)) return 'GOOD';

  if (/proportionate\s+deduction/.test(text)) return 'BAD';
  if (/room\s*rent/.test(text) && /proportionate/.test(text)) return 'BAD';
  if (/disease\s*-?wise|diseasewise/.test(text) && /sub\s*-?limit|sublimit/.test(text)) return 'BAD';
  if (/(will\s+not\s+be\s+available|not\s+available)/.test(text) && /(secure\s+benefit|plus\s+benefit|restore|cumulative\s+bonus)/.test(text)) return 'BAD';
  if (/shall\s+not\s+be\s+payable|under\s+no\s+circumstances|whatsoever/.test(text)) return 'BAD';

  // GREAT — must-capture big value benefits.
  if (/secure\s+benefit/.test(text)) return 'GREAT';
  if (/plus\s+benefit/.test(text)) return 'GREAT';
  if (/automatic\s+restore|restore\s+benefit|reinstat/.test(text)) return 'GREAT';
  if (/protect\s+benefit/.test(text)) return 'GREAT';
  if (/sum\s+insured/.test(text) && /(increase|additional|restore|reinstate)/.test(text)) return 'GREAT';

  // UNCLEAR — true discretion/ambiguity.
  if (/(at\s+our\s+sole\s+discretion|as\s+deemed|may\s+in\s+its\s+opinion)/.test(text)) return 'UNCLEAR';

  // GOOD — default.
  // Waiting periods, definitions, claim process, standard limits.
  if (/waiting\s+period/.test(text)) return 'GOOD';
  if (t.includes('claims_process') || /pre-?authori/.test(text)) return 'GOOD';
  if (/deductible|co-?pay|copay/.test(text)) return 'GOOD';

  return 'GOOD';
}

async function main() {
  const [inPath, outPath] = process.argv.slice(2);
  if (!inPath || !outPath) usage();
  await fsp.mkdir(path.dirname(outPath), { recursive: true });

  const raw = readJsonl(inPath).map((r) => ({
    clause_id: Number(r.clause_id),
    page: r.page,
    type: r.type,
    name: String(r.name ?? '').trim(),
    quote: String(r.quote ?? '').trim(),
    reference: r.reference ?? null,
    notes: r.notes,
  })).filter(r => r.name && r.quote);

  // de-dup exact repeats
  const seen = new Set();
  const items = [];
  for (const r of raw) {
    const k = `${r.type}||${r.name}||${r.quote}`;
    if (seen.has(k)) continue;
    seen.add(k);
    items.push(r);
  }

  const buckets = { GREAT: [], GOOD: [], BAD: [], UNCLEAR: [] };
  for (const it of items) {
    const b = classify(it);
    buckets[b].push(it);
  }

  const out = {
    GREAT: pickTop(buckets.GREAT, 5, [/secure\s+benefit/i, /plus\s+benefit/i, /restore/i, /sum\s+insured/i]).map(it => toOutItem(it, explain('GREAT', it))),
    GOOD: pickTop(buckets.GOOD, 5, [/pre\s*-?hospital/i, /post\s*-?hospital/i, /waiting\s+period/i, /deductible|co-?pay/i]).map(it => toOutItem(it, explain('GOOD', it))),
    BAD: pickTop(buckets.BAD, 5, [/proportionate\s+deduction/i, /room\s*rent/i, /sub\s*-?limit/i]).map(it => toOutItem(it, explain('BAD', it))),
    UNCLEAR: pickTop(buckets.UNCLEAR, 5).map(it => toOutItem(it, explain('UNCLEAR', it))),
    disclaimer: "Disclaimer: This analysis is for informational purposes only and does not constitute financial or insurance advice. Always read your policy documents carefully and consult with a licensed insurance advisor for specific guidance.",
  };

  await fsp.writeFile(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.error(`Wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
