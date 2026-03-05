import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) { console.error('Missing OPENAI_API_KEY in .env'); process.exit(1); }

const model = process.env.OPENAI_MODEL || 'gpt-4o';
const FORCE = process.argv.includes('--force');

// Collect all PDFs under policy-wording/
function getAllPdfs(dir) {
  const results = [];
  for (const insurer of fs.readdirSync(dir)) {
    const insurerPath = path.join(dir, insurer);
    if (!fs.statSync(insurerPath).isDirectory()) continue;
    for (const file of fs.readdirSync(insurerPath)) {
      if (file.endsWith('.pdf')) results.push(path.join(insurerPath, file));
    }
  }
  return results.sort();
}

function pdfToText(pdfPath) {
  const r = spawnSync('python3', ['scripts/pdf_to_text.py', pdfPath], {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(`pdf_to_text failed: ${r.stderr}`);
  return r.stdout;
}

function outPathFor(pdfPath) {
  const parts = pdfPath.replace(/\\/g, '/').split('/');
  const insurer = parts[parts.length - 2];
  const file = parts[parts.length - 1].replace('.pdf', '.json');
  return `out/${insurer}/${file}`;
}

async function analyze(pdfPath, system) {
  const policyText = pdfToText(pdfPath);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: policyText.slice(0, 450_000) },
      ],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No content in response');
  return JSON.parse(content);
}

// Build system prompt (same transform as analyze_one.mjs)
const systemBase = fs.readFileSync('prompts/original_edge_prompt.txt', 'utf8');
const system = systemBase.replace(
  'Now analyze the policy and submit using the tool.',
  `Now analyze the policy and respond with ONLY a valid JSON object (no markdown fences, no extra text) in this exact schema:

{
  "policyName": "string",
  "insurer": "string",
  "sumInsured": "string",
  "policyType": "Individual | Family Floater | Senior | Not specified",
  "documentType": "Policy Wording | Brochure | Policy Schedule | Mixed",
  "summary": { "great": 0, "good": 0, "bad": 0, "unclear": 0 },
  "features": {
    "great":   [{ "name": "string", "quote": "string", "reference": "string", "explanation": "string" }],
    "good":    [{ "name": "string", "quote": "string", "reference": "string", "explanation": "string" }],
    "bad":     [{ "name": "string", "quote": "string", "reference": "string", "explanation": "string" }],
    "unclear": [{ "name": "string", "quote": "string", "reference": "string", "explanation": "string" }]
  },
  "disclaimer": "Standard IRDAI exclusions apply. Please verify all details with your insurer or policy document."
}

The summary counts must equal the actual number of items in each features array.`
);

const pdfs = getAllPdfs('policy-wording');
console.log(`Found ${pdfs.length} PDFs\n`);

let done = 0, skipped = 0, failed = 0;
const failures = [];

for (const pdfPath of pdfs) {
  const outPath = outPathFor(pdfPath);

  if (!FORCE && fs.existsSync(outPath)) {
    console.log(`[skip] ${pdfPath}`);
    skipped++;
    continue;
  }

  console.log(`[→] ${pdfPath}`);
  try {
    const result = await analyze(pdfPath, system);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(`    ✓ saved ${outPath}  (great=${result.summary?.great} good=${result.summary?.good} bad=${result.summary?.bad} unclear=${result.summary?.unclear})`);
    done++;
  } catch (err) {
    console.error(`    ✗ FAILED: ${err.message}`);
    failures.push({ pdfPath, error: err.message });
    failed++;
  }
}

console.log(`\n═══════════════════════════════`);
console.log(`Done: ${done}  Skipped: ${skipped}  Failed: ${failed}`);
if (failures.length) {
  console.log('\nFailed files:');
  for (const f of failures) console.log(`  ${f.pdfPath}: ${f.error}`);
}
