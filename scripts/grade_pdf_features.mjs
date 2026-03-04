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

  const raw = readJsonl(inPath).map(r => ({
    clause_id: r.clause_id,
    page: r.page,
    type: r.type,
    name: r.name,
    quote: r.quote,
    reference: r.reference ?? null,
    notes: r.notes,
  }));

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

  deduped.sort((a, b) => typeWeight(b.type) - typeWeight(a.type));

  const maxItems = Number(process.env.GRADE_MAX_FEATURES ?? 800);
  const features = deduped.slice(0, maxItems);

  const system = fs.readFileSync(promptPath, 'utf8');
  const graded = await callOpenAI(system, features);

  // Post-process: ensure quotes come from input verbatim (best-effort).
  const allowedQuotes = new Set(features.map(f => f.quote));
  const allAllowed = features.map(f => f.quote);

  function fixItem(it) {
    if (!it || typeof it !== 'object') return null;
    const quote = String(it.quote ?? '');
    if (allowedQuotes.has(quote)) return it;

    // If the model returned a substring/snippet, replace with the full matching allowed quote.
    const candidate = allAllowed.find(q => q.includes(quote)) || allAllowed.find(q => quote.includes(q));
    if (candidate) {
      return { ...it, quote: candidate };
    }

    // If we can't verify, drop the item rather than outputing a fabricated quote.
    return null;
  }

  for (const bucket of ['GREAT', 'GOOD', 'BAD', 'UNCLEAR']) {
    if (!Array.isArray(graded[bucket])) continue;
    const fixed = graded[bucket].map(fixItem).filter(Boolean);
    graded[bucket] = fixed;
  }

  await fsp.writeFile(outPath, JSON.stringify(graded, null, 2), 'utf8');
  console.error(`Wrote ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
