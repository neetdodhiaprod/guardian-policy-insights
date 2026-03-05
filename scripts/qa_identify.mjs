/**
 * QA script: simulate the identify endpoint's scoreMatch logic against all known
 * overlap pairs to confirm the longer/more-specific policy always wins.
 *
 * Run: node scripts/qa_identify.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'out');

// ── scoreMatch (mirrors server/routes/policies.ts) ──────────────────────────

const GENERIC_WORDS = new Set([
  'health', 'insurance', 'care', 'plus', 'plan', 'policy', 'cover', 'benefit',
  'general', 'company', 'limited', 'india', 'insured', 'protect', 'new',
  'the', 'and', 'for', 'with', 'star', 'first',
]);

function specificWords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !GENERIC_WORDS.has(w));
}

function scoreMatch(titleText, fullText, policyName, policyId) {
  const title = titleText.toLowerCase();
  const full  = fullText.toLowerCase();
  const nameLower = policyName.toLowerCase();

  if (title.includes(nameLower)) return 100 + nameLower.length;
  if (full.includes(nameLower)) return 80 + nameLower.length;

  const nameWords = specificWords(policyName);
  const idWords   = specificWords(policyId.replace(/_/g, ' '));
  const specific  = [...new Set([...nameWords, ...idWords])];

  if (specific.length === 0) return 1;
  const hitsInTitle = specific.filter((w) => title.includes(w)).length;
  const hitsInFull  = specific.filter((w) => full.includes(w)).length;

  if (hitsInTitle === specific.length) return 70;
  if (specific.length > 1 && hitsInTitle >= specific.length - 1) return 50;
  return (hitsInFull / specific.length) * 20;
}

// ── Load all policies for an insurer ────────────────────────────────────────

function loadPolicies(insurerId) {
  const dir = path.join(OUT_DIR, insurerId);
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((file) => {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      return { id: file.replace('.json', ''), name: data.policyName ?? file.replace('.json', '') };
    });
}

// ── Simulate: pretend the PDF title IS the policy name ──────────────────────
// This is the adversarial case: e.g. "Optima Secure Global" title contains
// "optima secure" → without the fix, "Optima Secure" would win.

function simulateIdentify(insurerId, uploadedPolicyName) {
  const titleText = uploadedPolicyName.toLowerCase(); // simulated "title area" of PDF
  const fullText  = uploadedPolicyName.toLowerCase(); // same as title for simulation
  const candidates = loadPolicies(insurerId);

  let best = null;
  for (const { id, name } of candidates) {
    const score = scoreMatch(titleText, fullText, name, id);
    if (!best || score > best.score) best = { id, name, score };
  }
  return best;
}

// ── Test cases: each entry is { insurer, upload, expected } ─────────────────

const TESTS = [
  // HDFC ERGO — Optima chain
  { insurer: 'hdfc-ergo', upload: 'Optima Secure',             expected: 'Optima_Secure' },
  { insurer: 'hdfc-ergo', upload: 'Optima Secure Global',      expected: 'Optima_Secure_Global' },
  { insurer: 'hdfc-ergo', upload: 'Optima Secure Global Plus', expected: 'Optima_Secure_Global_Plus' },
  { insurer: 'hdfc-ergo', upload: 'Optima Restore',            expected: 'Optima_Restore' },
  { insurer: 'hdfc-ergo', upload: 'Optima Lite',               expected: 'Optima_Lite' },
  { insurer: 'hdfc-ergo', upload: 'Optima Senior',             expected: 'Optima_Senior' },
  { insurer: 'hdfc-ergo', upload: 'Optima Super Secure',       expected: 'Optima_Super_Secure' },
  { insurer: 'hdfc-ergo', upload: 'Easy Health Exclusive',     expected: 'Easy_Health_Exclusive' },
  { insurer: 'hdfc-ergo', upload: 'Easy Health Premium',       expected: 'Easy_Health_Premium' },
  { insurer: 'hdfc-ergo', upload: 'Easy Health Standard',      expected: 'Easy_Health_Standard' },
  { insurer: 'hdfc-ergo', upload: 'MyHealth Suraksha Gold',    expected: 'MyHealth_Suraksha_Gold' },
  { insurer: 'hdfc-ergo', upload: 'MyHealth Suraksha Platinum',expected: 'MyHealth_Suraksha_Platinum' },
  { insurer: 'hdfc-ergo', upload: 'MyHealth Suraksha Silver',  expected: 'MyHealth_Suraksha_Silver' },
  { insurer: 'hdfc-ergo', upload: 'Energy Gold',               expected: 'Energy_Gold' },
  { insurer: 'hdfc-ergo', upload: 'Energy Silver',             expected: 'Energy_Silver' },
  { insurer: 'hdfc-ergo', upload: 'EquiCover',                 expected: 'Equicover' },
  { insurer: 'hdfc-ergo', upload: 'Health Wallet',             expected: 'Health_Wallet' },
  // ICICI Lombard — overlap pairs
  { insurer: 'icici-lombard', upload: 'Health Shield 360',        expected: 'Health_Shield_360' },
  { insurer: 'icici-lombard', upload: 'Health Shield 360 Retail', expected: 'Health_Shield_360_Retail' },
  { insurer: 'icici-lombard', upload: 'iHealth',                  expected: 'iHealth' },
  { insurer: 'icici-lombard', upload: 'iHealth Plus',             expected: 'iHealth_Plus' },
  { insurer: 'icici-lombard', upload: 'Elevate',                  expected: 'Elevate' },
  { insurer: 'icici-lombard', upload: 'Health Elite Plus',        expected: 'Health_Elite_Plus' },
  // Care — overlap pairs
  { insurer: 'care', upload: 'Care',                          expected: 'Care_Care' },
  { insurer: 'care', upload: 'Care Supreme',                  expected: 'Care_Supreme' },
  { insurer: 'care', upload: 'Care Supreme Super Saver',      expected: 'Care_Supreme_Super_Saver' },
  { insurer: 'care', upload: 'Care Supreme Senior Premium',   expected: 'Care_Supreme_Senior_Premium' },
  { insurer: 'care', upload: 'Care Supreme Senior Super',     expected: 'Care_Supreme_Senior_Super' },
  { insurer: 'care', upload: 'Care Supreme VFM',              expected: 'Care_Supreme_VFM' },
  { insurer: 'care', upload: 'Care Classic',                  expected: 'Care_Classic' },
  { insurer: 'care', upload: 'Care Plus Complete',            expected: 'Care_Plus_Complete' },
  { insurer: 'care', upload: 'Care Plus Youth',               expected: 'Care_Plus_Youth' },
  { insurer: 'care', upload: 'Care Advantage',                expected: 'Care_Advantage' },
  { insurer: 'care', upload: 'Care Ultimate',                 expected: 'Care_Ultimate' },
  { insurer: 'care', upload: 'Care Senior',                   expected: 'Care_Senior' },
  { insurer: 'care', upload: 'Care Heart',                    expected: 'Care_Heart' },
  { insurer: 'care', upload: 'Care Freedom',                  expected: 'Care_Freedom' },
  // Niva Bupa — ReAssure chain
  { insurer: 'niva-bupa', upload: 'ReAssure',                  expected: 'ReAssure' },
  { insurer: 'niva-bupa', upload: 'ReAssure 2.0 Bronze+',      expected: 'ReAssure_2_Bronze_Plus' },
  { insurer: 'niva-bupa', upload: 'ReAssure 2.0 Platinum+',    expected: 'ReAssure_2_Platinum_Plus' },
  { insurer: 'niva-bupa', upload: 'ReAssure 2.0 Titanium+',    expected: 'ReAssure_2_Titanium_Plus' },
  { insurer: 'niva-bupa', upload: 'Aspire Diamond+',           expected: 'Aspire_Diamond_Plus' },
  { insurer: 'niva-bupa', upload: 'Aspire Gold+',              expected: 'Aspire_Gold_Plus' },
  { insurer: 'niva-bupa', upload: 'Aspire Platinum+',          expected: 'Aspire_Platinum_Plus' },
  { insurer: 'niva-bupa', upload: 'Aspire Titanium+',          expected: 'Aspire_Titanium_Plus' },
  { insurer: 'niva-bupa', upload: 'Health Premia Gold',        expected: 'Health_Premia_Gold' },
  { insurer: 'niva-bupa', upload: 'Health Premia Silver',      expected: 'Health_Premia_Silver' },
  { insurer: 'niva-bupa', upload: 'Health Premia Platinum',    expected: 'Health_Premia_Platinum' },
  { insurer: 'niva-bupa', upload: 'HeartBeat Gold',            expected: 'HeartBeat_Gold' },
  { insurer: 'niva-bupa', upload: 'HeartBeat Platinum',        expected: 'HeartBeat_Platinum' },
  { insurer: 'niva-bupa', upload: 'Senior First Gold',         expected: 'Senior_First_Gold' },
  { insurer: 'niva-bupa', upload: 'Senior First Platinum',     expected: 'Senior_First_Platinum' },
  // Star Health — overlap pairs
  { insurer: 'star-health-care', upload: 'Medi Classic',      expected: 'Medi_Classic' },
  { insurer: 'star-health-care', upload: 'Medi Classic Gold', expected: 'Medi_Classic_Gold' },
  { insurer: 'star-health-care', upload: 'Special Care',      expected: 'Special_Care' },
  { insurer: 'star-health-care', upload: 'Special Care Gold', expected: 'Special_Care_Gold' },
  { insurer: 'star-health-care', upload: 'Star Assure',       expected: 'Assure' },
  { insurer: 'star-health-care', upload: 'Comprehensive',     expected: 'Comprehensive' },
  { insurer: 'star-health-care', upload: 'Cancer Care Platinum',  expected: 'Cancer_Care_Platinum' },
  { insurer: 'star-health-care', upload: 'Cardiac Care Platinum', expected: 'Cardiac_Care_Platinum' },
  // Aditya Birla
  { insurer: 'aditya-birla', upload: 'Activ One MAX',  expected: 'Activ_One_MAX' },
  { insurer: 'aditya-birla', upload: 'Activ One MAX+', expected: 'Activ_One_MAX_Plus' },
  { insurer: 'aditya-birla', upload: 'Activ One NXT',  expected: 'Activ_One_NXT' },
  { insurer: 'aditya-birla', upload: 'Activ One VIP',  expected: 'Activ_One_VIP' },
  { insurer: 'aditya-birla', upload: 'Activ One VIP+', expected: 'Activ_One_VIP_Plus' },
  { insurer: 'aditya-birla', upload: 'Activ Care Classic',   expected: 'Activ_Care_Classic' },
  { insurer: 'aditya-birla', upload: 'Activ Care Premier',   expected: 'Activ_Care_Premier' },
  { insurer: 'aditya-birla', upload: 'Activ Care Standard',  expected: 'Activ_Care_Standard' },
  { insurer: 'aditya-birla', upload: 'Activ Health Platinum Enhanced', expected: 'Activ_Health_Platinum_Enhanced' },
  { insurer: 'aditya-birla', upload: 'Activ Health Platinum Essential', expected: 'Activ_Health_Platinum_Essential' },
];

// ── Run tests ────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

for (const { insurer, upload, expected } of TESTS) {
  const result = simulateIdentify(insurer, upload);
  // Normalize: compare id case-insensitively since some IDs differ in casing (e.g. EquiCover vs Equicover)
  const ok = result?.id?.toLowerCase() === expected.toLowerCase();
  if (ok) {
    passed++;
  } else {
    console.error(`FAIL  [${insurer}] "${upload}"`);
    console.error(`      expected: ${expected}`);
    console.error(`      got:      ${result?.id} (score=${result?.score})`);
    failed++;
  }
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
