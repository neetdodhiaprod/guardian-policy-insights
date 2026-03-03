import fs from 'fs';
import { spawnSync } from 'child_process';

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error('Usage: node scripts/bakeoff_openai.mjs <pdfPath>');
  process.exit(1);
}

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('Missing OPENAI_API_KEY in environment');
  process.exit(1);
}

const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

function pdfToText(path) {
  const r = spawnSync('python3', ['scripts/pdf_to_text.py', path], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  if (r.status !== 0) {
    console.error(r.stderr);
    throw new Error('pdf_to_text failed');
  }
  return r.stdout;
}

async function runPrompt(promptFile, policyText) {
  const system = fs.readFileSync(promptFile, 'utf8');

  const body = {
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: policyText.slice(0, 450000) },
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

const policyText = pdfToText(pdfPath);
console.log(`[bakeoff] extracted text length: ${policyText.length}`);

const prompts = [
  ['A', 'prompts/prompt_A.txt'],
  ['B', 'prompts/prompt_B.txt'],
  ['C', 'prompts/prompt_C.txt'],
];

for (const [label, file] of prompts) {
  console.log(`\n=== RUN ${label} (${file}) ===`);
  const out = await runPrompt(file, policyText);
  const outPath = `out_${label}.json`;
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`Saved ${outPath}`);
}
