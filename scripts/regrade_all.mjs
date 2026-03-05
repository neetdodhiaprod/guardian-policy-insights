/**
 * Re-grade all out/*\/*.json policies using the best rubric.
 * Produces: clean feature names (3-6 words, concept only), accurate bucketing,
 * and clear consumer-friendly explanations.
 *
 * Usage:
 *   node scripts/regrade_all.mjs                    # all policies
 *   node scripts/regrade_all.mjs hdfc-ergo          # one insurer
 *   node scripts/regrade_all.mjs hdfc-ergo/Optima_Secure  # one policy
 *
 * Requires: OPENAI_API_KEY in .env
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'out');
const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-5.2';

if (!API_KEY) { console.error('OPENAI_API_KEY missing in .env'); process.exit(1); }

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
You are a health insurance policy analysis expert specialising in Indian retail health insurance.

You will receive a JSON array of features already extracted from a policy wording document.
Each feature has:
  - name       : current feature name (may be verbose or wrong — you should improve it)
  - quote      : verbatim text from the policy (GROUND TRUTH — do not alter)
  - reference  : section/page reference (GROUND TRUTH — do not alter)
  - explanation: current explanation (may need improvement)

YOUR TASK: Re-grade each feature, assign a clean name, write a clear explanation, and place it in the correct bucket.

═══════════════════════════════════════════════════════════════
FEATURE NAME RULES (STRICT)
═══════════════════════════════════════════════════════════════
- 2–5 words maximum.
- Just the CONCEPT NAME — no values, no qualifiers, no explanations in the name.
- CORRECT: "Room Rent", "PED Waiting Period", "Co-pay", "Restore Benefit", "Initial Waiting Period", "NCB", "Consumables", "Air Ambulance", "Disease Sub-limits", "Pre-hospitalization Cover", "Post-hospitalization Cover", "Proportionate Deduction", "Cashless Network", "Modern Treatments", "Bariatric Surgery", "Domiciliary Hospitalization", "AYUSH Treatment", "Built-in SI Buffer", "Deductible", "Mental Health Coverage"
- WRONG: "Room Rent — At Actuals / No capping (unless schedule says otherwise)", "Co-pay (base plan): not explicitly stated as 0%", "Initial waiting period: 30 days (standard)"
- You MAY include a very short type qualifier ONLY if essential to distinguish two entries in the same bucket: e.g. "Co-pay (Mandatory)" vs "Co-pay (Optional)". Only do this if the policy truly has two separate co-pay items in the same bucket.

═══════════════════════════════════════════════════════════════
EXPLANATION RULES
═══════════════════════════════════════════════════════════════
- 2 sentences max, plain English, consumer-facing.
- Sentence 1: What the policy says / what the feature is.
- Sentence 2: What it means for you / why it matters.
- Do NOT start with "This feature" or "This policy" or the feature name.
- Include the key number/value (e.g. "36 months", "20%", "Single AC room") naturally in the text.

═══════════════════════════════════════════════════════════════
CATEGORISATION RUBRIC
═══════════════════════════════════════════════════════════════

CO-PAY RULE (ABSOLUTE — OVERRIDE ALL OTHER RULES):
  CRITICAL DISTINCTION — definition vs applied clause:
    - A GLOSSARY DEFINITION (e.g. "Co-Payment means a cost-sharing requirement where the insured bears a specified percentage...") is NOT a co-pay clause. Every IRDAI policy must include this definition. IGNORE IT.
    - An APPLIED CLAUSE actually charges the insured (e.g. "A co-pay of 10% applies", "You shall bear 20% of each claim", "Co-pay of 5% for age 60+", "Co-pay applicable under PPN option").

  If the document has an APPLIED co-pay clause → BAD. Always. No exceptions.
  This includes: optional co-pay, age-based co-pay, PPN co-pay, discounted plan co-pay, co-pay "if opted", co-pay for 60+ only, co-pay with unknown percentage, co-pay "as per schedule".
  If the ONLY co-pay mention is a glossary definition (no applied clause) → GREAT.
  In that GREAT case, the entry should say: name="Co-pay", explanation="No co-pay is charged on this plan — the insurer bears 100% of all admissible claims. This is better than most policies which charge 10–20% co-pay for senior citizens."

GREAT — better than market standard:
  Room Rent       : "At Actuals" / "Any room" / No limit / No capping
  PED Waiting     : < 24 months (12 months = GREAT)
  Specific Illness: < 24 months
  Initial Waiting : 0 days
  Co-pay          : No applied co-pay clause (glossary definition alone does not count — see CO-PAY RULE above)
  Restore Benefit : Covers SAME illness / Unlimited refills
  Consumables     : Fully covered
  Pre-hosp        : > 60 days
  Post-hosp       : > 180 days (strictly more than 180 days)
  NCB             : Does NOT reset to zero on a claim (partial-reduction is still GREAT)
  Cashless Network: > 10,000 hospitals
  Modern Treatments: No sub-limits
  Built-in SI Buffer: Any policy-funded extra SI that activates after base SI is exhausted (Secure Benefit, Super Reload, Plus Benefit, etc.)
  Bariatric Surgery: Covered

GOOD — meets market standard:
  Room Rent       : Single Private AC room (not at actuals, not capped in rupees)
  PED Waiting     : 24–48 months (2–4 years) — this is NEVER a red flag
  Specific Illness: 24 months
  Initial Waiting : 30 days with accident exception
  Restore Benefit : Unrelated illness only / once per year
  Pre-hosp        : 30–60 days
  Post-hosp       : 60–180 days (including exactly 180 days)
  NCB             : Resets to zero on a claim but exists
  Air Ambulance   : Covered (any limit)
  Domiciliary     : Covered
  Modern Treatments: Covered with sub-limits
  Cashless Network: 7,000–10,000 hospitals
  AYUSH           : Covered

BAD — worse than market standard (genuine red flags):
  Room Rent       : Any daily rupee cap (₹3,000/day etc.) — triggers proportionate deduction
  Proportionate Deduction: Only BAD when room rent has an actual cap. If room rent is "At Actuals" / "Any room", proportionate deduction CANNOT trigger — do NOT include it at all.
  PED Waiting     : > 48 months (more than 4 years only)
  Specific Illness: > 24 months
  Initial Waiting : > 30 days
  Co-pay          : Any APPLIED co-pay clause = BAD (see CO-PAY RULE above). A glossary definition alone is not an applied clause.
  Restore         : Not available
  Consumables     : Not covered
  Pre-hosp        : < 30 days
  Post-hosp       : < 60 days
  Disease Sub-limits: Any rupee sub-limit on specific diseases (cataract ₹40K, etc.)
  Cashless Network: < 7,000 hospitals

UNCLEAR — genuinely ambiguous:
  Use ONLY when: the policy wording is vague (e.g. "at insurer's discretion"), contradictory, or genuinely does not state a value that matters.
  NOTE: If no applied co-pay clause exists → GREAT (glossary definition alone = no co-pay). If an applied co-pay clause exists → BAD. Never put co-pay in UNCLEAR.
  DO NOT use UNCLEAR just because a value depends on Policy Schedule — infer the direction and put in GREAT/GOOD/BAD.

NEVER flag these (standard IRDAI exclusions): maternity not covered in base, infertility, cosmetic surgery, war, self-harm, dental unless accident, spectacles, HIV.

OPTIONAL COVERS: Generally, a restriction that only applies when the customer opts into an optional/discounted cover is a GOOD choice/flexibility — EXCEPT for co-pay. See CO-PAY RULE above. Co-pay is always BAD.

═══════════════════════════════════════════════════════════════
DE-DUPLICATION & LIMITS
═══════════════════════════════════════════════════════════════
- Each feature concept appears EXACTLY ONCE across ALL buckets. Never put the same feature in two buckets.
- Room Rent appears exactly once. Initial Waiting Period appears exactly once. Co-pay appears exactly once.
- When a feature has a default value + an optional upgrade, classify based on the DEFAULT value.
- Maximum 15 items per bucket.
- Only include features with consumer impact. Skip procedural/definitional items.

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT (strict JSON)
═══════════════════════════════════════════════════════════════
{
  "GREAT": [{"name":"...","quote":"...","reference":"...","explanation":"..."}],
  "GOOD":  [...],
  "BAD":   [...],
  "UNCLEAR":[...]
}
`.trim();

// ── OpenAI call ───────────────────────────────────────────────────────────────

async function regrade(features) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(features) },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
  return JSON.parse(data.choices[0].message.content);
}

// ── Process one policy file ───────────────────────────────────────────────────

async function processFile(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const existing = data.features ?? {};

  // Gather all features across all buckets, tagging with current bucket
  const allFeatures = [];
  for (const bucket of ['great', 'good', 'bad', 'unclear']) {
    for (const f of existing[bucket] ?? []) {
      if (!f.quote) continue; // skip features with no quote (unreliable)
      allFeatures.push({
        name: f.name ?? '',
        quote: f.quote,
        reference: f.reference ?? 'Not provided',
        explanation: f.explanation ?? '',
        _currentBucket: bucket, // hint for AI (it may override)
      });
    }
  }

  if (allFeatures.length === 0) {
    console.log(`  SKIP (no features): ${filePath}`);
    return;
  }

  let result;
  try {
    result = await regrade(allFeatures);
  } catch (err) {
    console.error(`  ERROR ${filePath}: ${err.message}`);
    return;
  }

  // Validate output structure
  for (const bucket of ['GREAT', 'GOOD', 'BAD', 'UNCLEAR']) {
    if (!Array.isArray(result[bucket])) result[bucket] = [];
  }

  // Write back
  data.features = {
    great: result.GREAT,
    good: result.GOOD,
    bad: result.BAD,
    unclear: result.UNCLEAR,
  };

  // Recompute summary counts
  data.summary = {
    great: data.features.great.length,
    good: data.features.good.length,
    bad: data.features.bad.length,
    unclear: data.features.unclear.length,
  };

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`  ✓ ${filePath.replace(OUT_DIR + '/', '')} — great:${data.summary.great} good:${data.summary.good} bad:${data.summary.bad} unclear:${data.summary.unclear}`);
}

// ── Collect files to process ──────────────────────────────────────────────────

const filter = process.argv[2]; // e.g. "hdfc-ergo" or "hdfc-ergo/Optima_Secure"

const filesToProcess = [];
for (const insurer of fs.readdirSync(OUT_DIR).sort()) {
  const insurerDir = path.join(OUT_DIR, insurer);
  if (!fs.statSync(insurerDir).isDirectory()) continue;
  if (filter && !insurer.startsWith(filter.split('/')[0])) continue;

  for (const file of fs.readdirSync(insurerDir).sort()) {
    if (!file.endsWith('.json')) continue;
    const policyId = file.replace('.json', '');
    if (filter?.includes('/') && !filter.endsWith(policyId)) continue;
    filesToProcess.push(path.join(insurerDir, file));
  }
}

const CONCURRENCY = 15;

console.log(`Re-grading ${filesToProcess.length} policies with ${MODEL} (concurrency=${CONCURRENCY})…\n`);

// Process in parallel batches of CONCURRENCY
for (let i = 0; i < filesToProcess.length; i += CONCURRENCY) {
  const batch = filesToProcess.slice(i, i + CONCURRENCY);
  await Promise.all(batch.map(processFile));
}

// ── Co-pay enforcement pass ───────────────────────────────────────────────────
// Deterministically move any co-pay entry in GOOD/UNCLEAR/GREAT (that isn't
// explicitly "no co-pay") to BAD. Runs on the same files just processed.

let copayFixed = 0;

for (const filePath of filesToProcess) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let changed = false;

  for (const fromBucket of ['great', 'good', 'unclear']) {
    const features = data.features?.[fromBucket] ?? [];
    const toKeep = [];
    const toMove = [];

    for (const f of features) {
      const nameLower = (f.name ?? '').toLowerCase();
      const isCoPayEntry = nameLower.includes('co-pay') || nameLower.includes('copay') || nameLower.includes('co pay');
      if (!isCoPayEntry) { toKeep.push(f); continue; }

      // Keep in GREAT only if explanation explicitly says there is no co-pay,
      // OR if the quote is only a glossary definition (not an applied clause)
      if (fromBucket === 'great') {
        const exp  = (f.explanation ?? '').toLowerCase();
        const quote = (f.quote ?? '').toLowerCase();
        const isDefinitionOnly =
          (quote.includes('co-payment means') || quote.includes('copayment means') || quote.includes('co payment means')) &&
          !quote.match(/\d+\s*%/) && // no percentage applied
          !quote.includes('shall bear') && !quote.includes('you will bear') && !quote.includes('insured shall pay');
        if (
          exp.includes('no co-pay') || exp.includes('no copay') ||
          exp.includes('zero co-pay') || exp.includes('not charged') ||
          isDefinitionOnly
        ) {
          toKeep.push(f); continue;
        }
      }

      toMove.push(f);
    }

    if (toMove.length > 0) {
      data.features[fromBucket] = toKeep;
      data.features.bad = [...(data.features.bad ?? []), ...toMove];
      copayFixed += toMove.length;
      changed = true;
    }
  }

  if (changed) {
    data.summary = {
      great:   data.features.great?.length ?? 0,
      good:    data.features.good?.length ?? 0,
      bad:     data.features.bad?.length ?? 0,
      unclear: data.features.unclear?.length ?? 0,
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}

if (copayFixed > 0) console.log(`\nCo-pay fix: moved ${copayFixed} entr${copayFixed === 1 ? 'y' : 'ies'} → BAD.`);
console.log('Done.');
