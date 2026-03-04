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
const promptPath = process.env.FEATURE_PROMPT ?? 'prompts/prompt_FEATURE_EXTRACTOR_V1.txt';

function usage() {
  console.error('Usage: node scripts/pass2_extract_features.mjs <clausesJsonl> <outJsonl>');
  process.exit(1);
}

function readJsonl(file) {
  const lines = fs.readFileSync(file, 'utf8').split(/\n/).filter(Boolean);
  return lines.map(l => JSON.parse(l));
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function callOpenAI(system, clausesChunk) {
  const body = {
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify(clausesChunk) },
    ],
  };

  const maxAttempts = Number(process.env.OPENAI_RETRIES ?? 6);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const raw = await res.text();

    // If the gateway returns HTML or otherwise non-JSON, retry.
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      if (attempt === maxAttempts) {
        throw new Error(`OpenAI non-JSON response (attempt ${attempt}/${maxAttempts}): ${raw.slice(0, 300)}`);
      }
      const backoff = Math.min(30000, 500 * 2 ** (attempt - 1));
      await sleep(backoff);
      continue;
    }

    if (!res.ok) {
      // Retry on common transient statuses.
      const retryable = [408, 429, 500, 502, 503, 504].includes(res.status);
      if (retryable && attempt < maxAttempts) {
        const backoff = Math.min(30000, 500 * 2 ** (attempt - 1));
        await sleep(backoff);
        continue;
      }
      throw new Error(`OpenAI error ${res.status}: ${JSON.stringify(data).slice(0, 2000)}`);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      if (attempt === maxAttempts) throw new Error('No content in response');
      const backoff = Math.min(30000, 500 * 2 ** (attempt - 1));
      await sleep(backoff);
      continue;
    }

    try {
      return JSON.parse(content);
    } catch {
      if (attempt === maxAttempts) {
        throw new Error(`Model returned non-JSON content: ${String(content).slice(0, 300)}`);
      }
      const backoff = Math.min(30000, 500 * 2 ** (attempt - 1));
      await sleep(backoff);
    }
  }

  throw new Error('callOpenAI: exhausted retries');
}

async function main() {
  const [inPath, outPath] = process.argv.slice(2);
  if (!inPath || !outPath) usage();

  await fsp.mkdir(path.dirname(outPath), { recursive: true });

  const clauses = readJsonl(inPath).map(r => ({
    clause_id: r.clause_id,
    page: r.page,
    text: r.text,
  }));

  const system = fs.readFileSync(promptPath, 'utf8');

  // Write-atomic: write to temp file, then rename on success.
  const tmpPath = `${outPath}.tmp`;
  const outStream = fs.createWriteStream(tmpPath, { flags: 'w' });

  const chunks = chunk(clauses, Number(process.env.FEATURE_CHUNK_SIZE ?? 25));
  console.error(`[pass2] clauses=${clauses.length} chunks=${chunks.length} model=${model}`);

  let featuresWritten = 0;

  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    console.error(`[pass2] chunk ${i + 1}/${chunks.length} (clauses ${c[0].clause_id}..${c[c.length - 1].clause_id})`);

    const resp = await callOpenAI(system, c);
    const features = Array.isArray(resp?.features) ? resp.features : [];

    for (const f of features) {
      outStream.write(JSON.stringify(f) + '\n');
      featuresWritten++;
    }
  }

  await new Promise(resolve => outStream.end(resolve));

  await fsp.rename(tmpPath, outPath);
  console.error(`[pass2] wrote ${featuresWritten} feature records to ${outPath}`);
}

main().catch(async err => {
  console.error(err);
  // Best-effort cleanup of temp file if present.
  try {
    const [_, outPath] = process.argv.slice(2);
    if (outPath) await fsp.rm(`${outPath}.tmp`, { force: true });
  } catch {}
  process.exit(1);
});
