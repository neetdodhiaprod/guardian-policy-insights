#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('Missing OPENAI_API_KEY in environment');
  process.exit(1);
}

const model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
const promptPath = process.env.GRADE_PROMPT ?? 'prompts/prompt_C_bucket_from_features_v1.txt';

function usage() {
  console.error('Usage: node scripts/grade_pdf_features.mjs <featuresJsonl> <outJsonPath>');
  process.exit(1);
}

function readJsonl(file) {
  const lines = fs.readFileSync(file, 'utf8').split(/\n/).filter(Boolean);
  return lines.map(l => JSON.parse(l));
}

async function callOpenAI(system, features) {
  const body = {
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify(features).slice(0, 450000) },
    ],
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`OpenAI error ${res.status}: ${JSON.stringify(data).slice(0, 2000)}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No content in response');
  return JSON.parse(content);
}

async function main() {
  const [inPath, outPath] = process.argv.slice(2);
  if (!inPath || !outPath) usage();

  await fsp.mkdir(path.dirname(outPath), { recursive: true });

  const pdfBase = path.basename(inPath).replace(/\.features\.jsonl$/, '');
  const clausesPath = path.join('dist/features/clauses', `${pdfBase}.clauses.jsonl`);

  // Load clause texts so we can ground/repair quotes.
  const clauseTextById = new Map();
  try {
    const clauseLines = fs.readFileSync(clausesPath, 'utf8').split(/\n/).filter(Boolean);
    for (const l of clauseLines) {
      try {
        const r = JSON.parse(l);
        if (r?.clause_id != null && r?.text) clauseTextById.set(Number(r.clause_id), String(r.text));
      } catch {}
    }
  } catch {
    // ok if missing
  }

  const raw = readJsonl(inPath).map(r => {
    const clauseId = Number(r.clause_id);
    let quote = String(r.quote ?? '');
    const clauseText = clauseTextById.get(clauseId);

    // If extracted quote is truncated/low-quality, replace with full clause text.
    if ((quote.includes('...') || quote.length < 40) && clauseText) {
      quote = clauseText;
    }

    return {
      clause_id: clauseId,
      page: r.page,
      type: r.type,
      name: r.name,
      quote,
      reference: r.reference ?? null,
      notes: r.notes,
    };
  });

  // Keep the payload bounded: de-dup identical extracted items and prioritize high-signal types.
  const seen = new Set();
  const deduped = [];
  for (const r of raw) {
    const k = `${r.type}||${r.name}||${r.quote}`;
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(r);
  }

  const typeWeight = (t) => {
    switch (t) {
      case 'deductible_copay': return 100;
      case 'limit': return 95;
      case 'exclusion': return 90;
      case 'waiting_period': return 85;
      case 'claims_process': return 80;
      case 'condition': return 75;
      case 'optional_cover': return 70;
      case 'benefit': return 65;
      case 'definition_impact': return 20;
      default: return 50;
    }
  };

  const quotePenalty = (q) => {
    const s = String(q ?? '');
    let p = 0;
    if (s.includes('...')) p += 50;
    if (s.length < 40) p += 20;
    return p;
  };

  deduped.sort((a, b) => {
    const tw = typeWeight(b.type) - typeWeight(a.type);
    if (tw !== 0) return tw;
    // Prefer higher-quality (non-ellipsis, longer) quotes
    return quotePenalty(a.quote) - quotePenalty(b.quote);
  });

  const maxItems = Number(process.env.GRADE_MAX_FEATURES ?? 800);
  const features = deduped.slice(0, maxItems);

  const system = fs.readFileSync(promptPath, 'utf8');
  const graded = await callOpenAI(system, features);

  // Post-process: ensure quotes come from input verbatim (best-effort).
  const allowedQuotes = new Set(features.map(f => f.quote));
  const allAllowed = features.map(f => f.quote);

  function fixItem(it) {
    if (!it || typeof it !== 'object') return null;

    // Normalize reference.
    const ref = it.reference == null ? 'Not provided' : String(it.reference);

    const quote = String(it.quote ?? '');
    if (allowedQuotes.has(quote)) return { ...it, reference: ref };

    // If the model returned a substring/snippet, replace with the full matching allowed quote.
    const candidate = allAllowed.find(q => q.includes(quote)) || allAllowed.find(q => quote.includes(q));
    if (candidate) {
      return { ...it, quote: candidate, reference: ref };
    }

    // If we can't verify, drop the item rather than outputing a fabricated quote.
    return null;
  }

  // Fix/verify bucket items (quotes must come from inputs).
  for (const bucket of ['GREAT', 'GOOD', 'BAD', 'UNCLEAR']) {
    if (!Array.isArray(graded[bucket])) continue;
    const fixed = graded[bucket].map(fixItem).filter(Boolean);
    graded[bucket] = fixed;
  }

  // Fix/verify BASICS checklist (allows UNKNOWN entries with empty quotes).
  if (Array.isArray(graded.BASICS)) {
    const fixedBasics = [];
    for (const it of graded.BASICS) {
      if (!it || typeof it !== 'object') continue;
      const quote = String(it.quote ?? '');

      // UNKNOWN entries can have blank quote.
      if (!quote) {
        fixedBasics.push({
          category: String(it.category ?? ''),
          verdict: String(it.verdict ?? 'UNKNOWN'),
          name: String(it.name ?? 'Not found'),
          quote: '',
          reference: it.reference == null ? 'Not provided' : String(it.reference),
          explanation: String(it.explanation ?? 'Not found in extracted features.'),
        });
        continue;
      }

      const fixed = fixItem(it);
      if (fixed) {
        fixedBasics.push({
          category: String(it.category ?? ''),
          verdict: String(it.verdict ?? ''),
          name: String(it.name ?? ''),
          quote: fixed.quote,
          reference: fixed.reference,
          explanation: String(it.explanation ?? ''),
        });
      }
    }
    graded.BASICS = fixedBasics;
  }

  // Enforce: same quote cannot appear in more than one bucket.
  const buckets = ['BAD', 'GREAT', 'GOOD', 'UNCLEAR'];
  const seenQuote = new Map(); // quote -> bucket

  for (const b of buckets) {
    const arr = Array.isArray(graded[b]) ? graded[b] : [];
    const out = [];
    for (const it of arr) {
      const q = String(it.quote ?? '');

      // Do not auto-demote schedule-dependent quotes; prompt handles conditionality.

      const prior = seenQuote.get(q);
      if (prior) continue;
      seenQuote.set(q, b);
      out.push(it);
    }
    graded[b] = out;
  }

  // Hard post-rules to enforce your preferences.
  // PED waiting 36 months -> GOOD (standard)
  // Initial waiting 30 days -> GOOD (standard)
  const moveToGood = (predicate) => {
    for (const b of ['GREAT', 'BAD', 'UNCLEAR']) {
      const arr = Array.isArray(graded[b]) ? graded[b] : [];
      const keep = [];
      for (const it of arr) {
        const q = String(it.quote ?? '');
        if (predicate(q, it)) {
          graded.GOOD = Array.isArray(graded.GOOD) ? graded.GOOD : [];
          // Avoid duplicates in GOOD
          if (!graded.GOOD.some(x => String(x.quote ?? '') === q)) graded.GOOD.push(it);
        } else {
          keep.push(it);
        }
      }
      graded[b] = keep;
    }
  };

  // Keep BAD strict: demote non-claim-shock downsides into GOOD.
  // (We err on the side of not scaring customers.)
  const isClaimShockRedFlag = (q) => {
    const s = String(q ?? '').toLowerCase();

    // Very strong signals.
    if (s.includes('proportionate deduction')) return true;
    if (s.includes('proportionate') && s.includes('room')) return true;

    // Broad denial mechanics / severe restrictions.
    if (/(not payable|shall not be payable|no liability|not covered)/i.test(s) && /(in any case|whatsoever|under any circumstances)/i.test(s)) return true;

    // Disease-wise sublimits and hard caps.
    if (/(sub-?limit|sublimit|disease[-\s]?wise)/i.test(s) && /(maximum|limited to|up to)/i.test(s)) return true;

    // Co-pay / deductible that is clearly mandatory and material (best-effort heuristic).
    if (/(co-?pay|copay|deductible)/i.test(s) && /(mandatory|shall|applicable|borne by insured)/i.test(s) && /(\b2\d\b|\b3\d\b|\b4\d\b|\b50\b)\s*%/.test(s)) return true;

    return false;
  };

  if (Array.isArray(graded.BAD)) {
    const keepBad = [];
    for (const it of graded.BAD) {
      const q = String(it.quote ?? '');
      if (isClaimShockRedFlag(q)) {
        keepBad.push(it);
      } else {
        graded.GOOD = Array.isArray(graded.GOOD) ? graded.GOOD : [];
        if (!graded.GOOD.some(x => String(x.quote ?? '') === q)) graded.GOOD.push(it);
      }
    }
    graded.BAD = keepBad;
  }

  moveToGood((q) => /pre\s*-?existing\s+disease/i.test(q) && /\b36\s*months\b/i.test(q));
  moveToGood((q) => /\bwithin\s+30\s+days\b/i.test(q) && /excluded\s+except\s+claims\s+arising\s+due\s+to\s+an\s+accident/i.test(q));

  // Clean up UNCLEAR: per latest spec, UNCLEAR should NOT be used for schedule/variant dependence.
  // Keep UNCLEAR only for truly vague/ambiguous wording. Move schedule-driven items to GOOD/BAD with caveats.
  if (Array.isArray(graded.UNCLEAR)) {
    const keep = [];
    for (const it of graded.UNCLEAR) {
      const q = String(it.quote ?? '');
      const looksLikeTable = q.split(/\n/).length > 6 || (q.includes('/') && /\b\d{2,}\b/.test(q));
      if (looksLikeTable) {
        // Drop unreadable table garbage rather than confusing the user.
        continue;
      }

      const scheduleish = /policy\s+schedule|as\s+specified|unless\s+otherwise\s+specified|optional\s+cover|plan\s+variant/i.test(q);
      if (scheduleish) {
        // Route to BAD if it is clearly a payout reducer; otherwise GOOD.
        const payoutReducer = /excluded|not\s+payable|deductible|co-?pay|proportionate\s+deduction|sub-?limit|maximum\s+liability/i.test(q);
        const target = payoutReducer ? 'BAD' : 'GOOD';
        graded[target] = Array.isArray(graded[target]) ? graded[target] : [];
        if (!graded[target].some(x => String(x.quote ?? '') === q)) graded[target].push(it);
        continue;
      }

      // Otherwise, keep in UNCLEAR only for true ambiguity/discretion.
      const trulyAmbiguous = /discretion|as\s+deemed|as\s+decided|reasonable\s+and\s+customary|may\s+in\s+its\s+sole\s+opinion/i.test(q);
      if (trulyAmbiguous) {
        keep.push(it);
      } else {
        // Default: treat as GOOD informational clause.
        graded.GOOD = Array.isArray(graded.GOOD) ? graded.GOOD : [];
        if (!graded.GOOD.some(x => String(x.quote ?? '') === q)) graded.GOOD.push(it);
      }
    }
    graded.UNCLEAR = keep;
  }

  await fsp.writeFile(outPath, JSON.stringify(graded, null, 2), 'utf8');
  console.error(`Wrote ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
