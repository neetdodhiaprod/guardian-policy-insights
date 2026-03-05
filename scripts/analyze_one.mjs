import fs from 'fs';
import { spawnSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error('Usage: node scripts/analyze_one.mjs <pdfPath>');
  console.error('Example: node scripts/analyze_one.mjs policy-wording/hdfc-ergo/Optima_Secure.pdf');
  process.exit(1);
}

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('Missing OPENAI_API_KEY in .env');
  process.exit(1);
}

const model = process.env.OPENAI_MODEL || 'gpt-4o';

// Extract text from PDF via existing python script
function pdfToText(path) {
  const r = spawnSync('python3', ['scripts/pdf_to_text.py', path], {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  if (r.status !== 0) {
    console.error(r.stderr);
    throw new Error('pdf_to_text.py failed');
  }
  return r.stdout;
}

// Load the original edge prompt and swap the tool instruction for JSON output
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

const policyText = pdfToText(pdfPath);
console.log(`[analyze] PDF: ${pdfPath}`);
console.log(`[analyze] Extracted text: ${policyText.length.toLocaleString()} chars`);
console.log(`[analyze] Model: ${model}`);
console.log(`[analyze] Calling OpenAI...`);

const res = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'authorization': `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: policyText.slice(0, 450_000) },
    ],
  }),
});

const data = await res.json();
if (!res.ok) {
  console.error('OpenAI error:', JSON.stringify(data, null, 2));
  process.exit(1);
}

const content = data.choices?.[0]?.message?.content;
if (!content) {
  console.error('No content in response:', JSON.stringify(data, null, 2));
  process.exit(1);
}

const result = JSON.parse(content);

// Derive output path: out/<insurer>/<policy>.json
const parts = pdfPath.replace(/\\/g, '/').split('/');
const insurer = parts[parts.length - 2];
const policyFile = parts[parts.length - 1].replace('.pdf', '.json');
const outDir = `out/${insurer}`;
fs.mkdirSync(outDir, { recursive: true });
const outPath = `${outDir}/${policyFile}`;
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

console.log(`\n[analyze] Done! Saved → ${outPath}`);
console.log(`[analyze] Summary: great=${result.summary?.great}  good=${result.summary?.good}  bad=${result.summary?.bad}  unclear=${result.summary?.unclear}`);
console.log('\n--- PREVIEW ---');
console.log(JSON.stringify(result, null, 2).slice(0, 3000));
