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
const rubricPath = process.env.RUBRIC_PROMPT ?? 'prompts/prompt_original_spec_v3.txt';

function usage() {
  console.error('Usage: node scripts/grade_pdf_all_clauses_openai.mjs <clausesJsonl> <outJsonPath>');
  process.exit(1);
}

function readJsonl(file) {
  return fs.readFileSync(file, 'utf8').split(/\n/).filter(Boolean).map(l => JSON.parse(l));
}

function chunkByChars(items, maxChars) {
  const chunks = [];
  let cur = [];
  let curLen = 0;
  for (const it of items) {
    const s = JSON.stringify(it);
    if (curLen + s.length > maxChars && cur.length) {
      chunks.push(cur);
      cur = [];
      curLen = 0;
    }
    cur.push(it);
    curLen += s.length;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

async function callOpenAI(system, user) {
  const body = {
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`OpenAI error ${res.status}: ${JSON.stringify(data).slice(0, 2000)}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No content in response');
  return JSON.parse(content);
}

function mergeBuckets(parts) {
  const out = { GREAT: [], GOOD: [], BAD: [], UNCLEAR: [], disclaimer: null };
  const seen = new Set();

  for (const p of parts) {
    for (const b of ['GREAT', 'GOOD', 'BAD', 'UNCLEAR']) {
      const arr = Array.isArray(p?.[b]) ? p[b] : [];
      for (const it of arr) {
        const q = String(it?.quote ?? '');
        const key = `${b}||${String(it?.name ?? '')}||${q}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out[b].push(it);
      }
    }
    if (!out.disclaimer && p?.disclaimer) out.disclaimer = p.disclaimer;
  }

  if (!out.disclaimer) {
    out.disclaimer = 'Standard IRDAI exclusions apply. Please verify all details with your insurer or policy document.';
  }

  return out;
}

async function main() {
  const [inPath, outPath] = process.argv.slice(2);
  if (!inPath || !outPath) usage();

  await fsp.mkdir(path.dirname(outPath), { recursive: true });

  const rubric = fs.readFileSync(rubricPath, 'utf8');
  const clauses = readJsonl(inPath).map(r => ({
    clause_id: r.clause_id,
    page: r.page,
    reference: r.reference ?? null,
    text: r.text
  }));

  // Chunk to fit request limits.
  const chunks = chunkByChars(clauses, 140000);
  const parts = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const user = [
      `Policy wording (chunk ${i + 1}/${chunks.length}).`,
      `From ONLY the text below, extract and bucket meaningful customer-impacting features into GREAT/GOOD/BAD/UNCLEAR exactly per the rubric.`,
      `Return STRICT JSON with keys GREAT, GOOD, BAD, UNCLEAR, disclaimer.`,
      `For each item include: name, quote (verbatim), reference, explanation.`,
      `Do not invent limits. Do not include standard IRDAI exclusions.`,
      '',
      JSON.stringify(chunk)
    ].join('\n');

    const part = await callOpenAI(rubric, user);
    parts.push(part);
  }

  // Merge + de-dupe.
  const merged = mergeBuckets(parts);

  // Light cap to avoid huge outputs (UI can still show more via separate runs later).
  for (const b of ['GREAT', 'GOOD', 'BAD', 'UNCLEAR']) {
    if (Array.isArray(merged[b]) && merged[b].length > 50) merged[b] = merged[b].slice(0, 50);
  }

  await fsp.writeFile(outPath, JSON.stringify(merged, null, 2), 'utf8');
  console.error(`Wrote ${outPath} (chunks=${chunks.length})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
