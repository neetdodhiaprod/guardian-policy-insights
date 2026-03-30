import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.resolve(process.cwd(), 'out');

function safeSegment(s: string) {
  return s.replace(/[^a-zA-Z0-9._-]/g, '');
}

export const INSURER_META = [
  {
    id: 'aditya-birla',
    label: 'Aditya Birla Health Insurance',
    patterns: ['aditya birla health insurance', 'aditya birla', 'abhi', 'activ'],
  },
  {
    id: 'care',
    label: 'Care Health Insurance',
    patterns: ['care health insurance', 'care health', 'religare health'],
  },
  {
    id: 'hdfc-ergo',
    label: 'HDFC ERGO',
    patterns: ['hdfc ergo general insurance', 'hdfc ergo health insurance', 'hdfc ergo'],
  },
  {
    id: 'icici-lombard',
    label: 'ICICI Lombard',
    patterns: ['icici lombard general insurance', 'icici lombard'],
  },
  {
    id: 'niva-bupa',
    label: 'Niva Bupa',
    patterns: ['niva bupa health insurance', 'niva bupa', 'max bupa'],
  },
  {
    id: 'star-health-care',
    label: 'Star Health',
    patterns: ['star health and allied insurance', 'star health insurance', 'star health'],
  },
];

// Keywords that confirm a retail health insurance policy wording
const HEALTH_KEYWORDS = [
  'hospitalization', 'sum insured', 'network hospital', 'cashless',
  'pre-existing disease', 'waiting period', 'room rent', 'health insurance',
  'mediclaim', 'irdai', 'insured person', 'policy schedule',
];

// Keywords that suggest this is NOT retail health (life, motor, travel, etc.)
const REJECT_KEYWORDS = [
  'life insurance', 'sum assured', 'death benefit', 'motor insurance',
  'vehicle insurance', 'travel insurance', 'home insurance',
  'endowment', 'term plan', 'ulip',
];

function loadAllPoliciesForInsurer(insurerId: string) {
  const dir = path.join(OUT_DIR, insurerId);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json') && f !== 'verification_matrix.csv')
    .map((file) => {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      return { id: file.replace('.json', ''), data };
    });
}

// Words too common in any health insurance document to be useful for matching
const GENERIC_WORDS = new Set([
  'health', 'insurance', 'care', 'plus', 'plan', 'policy', 'cover', 'benefit',
  'general', 'company', 'limited', 'india', 'insured', 'protect', 'new',
  'the', 'and', 'for', 'with', 'star', 'first',
]);

function specificWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !GENERIC_WORDS.has(w));
}

/**
 * Score how well the given policy matches the PDF text.
 * titleText = first ~8,000 chars (most likely to contain product name on cover pages).
 * fullText  = full extracted text for fallback.
 */
function scoreMatch(titleText: string, fullText: string, policyName: string, policyId: string): number {
  const title = titleText.toLowerCase();
  const full  = fullText.toLowerCase();
  const nameLower = policyName.toLowerCase();

  // Tier 1: exact phrase in title area — highest confidence.
  // Add name length so "Optima Secure Global Plus" (longer) beats "Optima Secure" (shorter)
  // when both are substrings of the same document title.
  if (title.includes(nameLower)) return 100 + nameLower.length;
  // Tier 2: exact phrase anywhere in document
  if (full.includes(nameLower)) return 80 + nameLower.length;

  // Tier 3: all specific words from both policyName and file ID must appear in title
  const nameWords = specificWords(policyName);
  const idWords   = specificWords(policyId.replace(/_/g, ' '));
  const specific  = [...new Set([...nameWords, ...idWords])];

  if (specific.length === 0) return 1; // fully generic name — only wins by elimination
  const hitsInTitle = specific.filter((w) => title.includes(w)).length;
  const hitsInFull  = specific.filter((w) => full.includes(w)).length;

  // All specific words in title = strong match
  if (hitsInTitle === specific.length) return 70;
  // Most specific words in title
  if (specific.length > 1 && hitsInTitle >= specific.length - 1) return 50;
  // Fall back to full-text ratio
  return (hitsInFull / specific.length) * 20;
}

// ─── Customer info extraction ───────────────────────────────────────────────

export interface CustomerInfo {
  customerName: string | null;
  policyType: string | null;
  sumInsured: string | null;
  totalPremium: string | null;
  primaryDOB: string | null;
  age: number | null;
  city: string | null;
  premiumTier: string | null;
  preExistingDiseases: string[];
  policyPeriod: string | null;
  members: Array<{ name: string; relation: string; dob: string }>;
}

function dobToAge(dob: string): number | null {
  const parts = dob.split(/[\/\-]/);
  if (parts.length !== 3) return null;
  const yearStr = parts[2];
  const year = parseInt(yearStr.length === 2 ? '20' + yearStr : yearStr, 10);
  if (isNaN(year) || year < 1900 || year > new Date().getFullYear()) return null;
  return new Date().getFullYear() - year;
}

export function extractCustomerInfo(rawText: string): CustomerInfo {
  const grab = (pattern: RegExp): string | null => {
    const m = rawText.match(pattern);
    return m ? m[1].trim() : null;
  };

  // Policyholder name
  const customerName = grab(/Policyholder\s+Name\s*[:\-]\s*([^\n\r]{3,60})/i)
    ?? grab(/Name\s+of\s+(?:Insured|Proposer)\s*[:\-]\s*([^\n\r]{3,60})/i);

  // Policy type
  const policyType = grab(/Policy\s+Type\s*[:\-]\s*([^\n\r]{3,50})/i);

  // Sum insured — "Sum Insured opted:2500000" or "Base Sum Insured ... 2500000"
  const siRaw = grab(/Sum\s+Insured\s+opted[:\s]+(\d[\d,]+)/i)
    ?? grab(/Base\s+Sum\s+Insured[^\d]*(\d[\d,]+)/i)
    ?? grab(/Sum\s+Insured[^\d]*(\d[\d,]{4,})/i);
  const sumInsured = siRaw ? siRaw.replace(/,/g, '') : null;

  // Total premium — "received an amount of ₹ 28534" or "Total Premium ... 28534"
  const premRaw = grab(/received\s+an\s+amount\s+of\s*[`₹\s]*([\d,]+)/i)
    ?? grab(/Total\s+Premium\s+(?:\([^)]+\)\s*)?[:\-]\s*[₹\s]*([\d,]+(?:\.\d{2})?)/i)
    ?? grab(/(?:Net\s+Premium|Annual\s+Premium)\s*[:\-]\s*[₹\s]*([\d,]+(?:\.\d{2})?)/i);
  const totalPremium = premRaw ? premRaw.replace(/,/g, '') : null;

  // Primary insured DOB (Self row)
  const primaryDOB = grab(/\bSelf\b\s+(?:Male|Female)\s+(\d{1,2}\/\d{2}\/\d{4})/i)
    ?? grab(/Date\s+of\s+Birth\s*[:\-]\s*(\d{1,2}[\/\-]\d{2}[\/\-]\d{2,4})/i);
  const age = primaryDOB ? dobToAge(primaryDOB) : null;

  // Premium Tier (HDFC ERGO explicit field — city tier indicator)
  const premiumTier = grab(/Premium\s+Tier\s*[:\-]\s*([^\n\r\s]{2,10})/i);

  // City from address block — "MUMBAI, MAHARASHTRA-400030"
  const cityMatch = rawText.match(/([A-Z][A-Za-z\s]{2,20}),\s*[A-Z][A-Za-z\s]+-\d{6}/);
  const city = cityMatch ? cityMatch[1].trim() : null;

  // Policy period
  const policyPeriod = grab(/Period\s+of\s+Insurance\s*[:\-]\s*From\s+(\d{2}\/\d{2}\/\d{4}[^\n\r]{0,30})/i)
    ?? grab(/Policy\s+Period\s*[:\-]\s*([^\n\r]{5,60})/i);

  // Pre-existing diseases — from Special Conditions table
  const predRaw = grab(/Declared\s+Pre.existing\s+Disease\s*[:\n\r]+([A-Z_0-9][A-Z_0-9\s,]+)/i)
    ?? grab(/Special\s+Condition[^:\n]*[:\-]\s*([A-Z][A-Z_0-9\s,]+)/i);
  const preExistingDiseases = predRaw
    ? predRaw.split(/[,\n]/).map(s => s.trim().replace(/_/g, ' ')).filter(Boolean)
    : [];

  // Members: scan for "Name Relation Gender DOB" rows.
  // Only match Title Case words (e.g. "Rishi Kapoor") — rejects ALL-CAPS tokens and OCR garbage.
  const memberPattern = /((?:[A-Z][a-z]+)(?:\s+[A-Z][a-z]+){0,3})\s+(Self|Spouse|Son|Daughter|Father|Mother|Parent|Employee|Dependent)\s+(?:Male|Female)\s+(\d{1,2}\/\d{2}\/\d{4})/g;
  // Common short Title-Case words that are NOT names
  const NAME_STOPWORDS = new Set(['Yes', 'No', 'The', 'An', 'In', 'Of', 'For', 'To', 'As', 'By', 'Or', 'At', 'Is', 'Be', 'On']);
  // Post-process: keep only trailing non-stopword Title Case tokens.
  function cleanMemberName(raw: string): string {
    const words = raw.trim().split(/\s+/);
    const clean: string[] = [];
    for (let i = words.length - 1; i >= 0; i--) {
      if (/^[A-Z][a-z]{1,}$/.test(words[i]) && !NAME_STOPWORDS.has(words[i])) clean.unshift(words[i]);
      else break;
    }
    return clean.length >= 1 ? clean.join(' ') : raw.trim();
  }
  const seenMembers = new Set<string>();
  const members: CustomerInfo['members'] = [];
  let m: RegExpExecArray | null;
  while ((m = memberPattern.exec(rawText)) !== null) {
    const name = cleanMemberName(m[1]);
    const key = `${name}|${m[3]}`; // deduplicate by name+dob
    if (!seenMembers.has(key)) {
      seenMembers.add(key);
      members.push({ name, relation: m[2], dob: m[3] });
    }
  }

  return { customerName, policyType, sumInsured, totalPremium, primaryDOB, age, city, premiumTier, preExistingDiseases, policyPeriod, members };
}

// ────────────────────────────────────────────────────────────────────────────

export const policiesRouter = Router();

// GET /api/policies  →  { insurers: [{ id, label, policies: [{ id, policyName, summary }] }] }
policiesRouter.get('/policies', (_req, res) => {
  if (!fs.existsSync(OUT_DIR)) {
    return res.status(404).json({ error: 'out/ directory not found' });
  }

  const insurers = INSURER_META.map((meta) => {
    const dir = path.join(OUT_DIR, meta.id);
    if (!fs.existsSync(dir)) return { ...meta, policies: [] };

    const policies = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json') && f !== 'verification_matrix.csv')
      .sort()
      .map((file) => {
        const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
        return {
          id: file.replace('.json', ''),
          policyName: data.policyName ?? file.replace('.json', ''),
          policyType: data.policyType ?? '',
          summary: data.summary ?? { great: 0, good: 0, bad: 0, unclear: 0 },
        };
      });

    return { id: meta.id, label: meta.label, policies };
  });

  res.json({ insurers });
});

// GET /api/policies/:insurer/:policy  →  full policy JSON
policiesRouter.get('/policies/:insurer/:policy', (req, res) => {
  const insurer = safeSegment(req.params.insurer);
  const policy  = safeSegment(req.params.policy);

  const filePath = path.join(OUT_DIR, insurer, `${policy}.json`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: `Policy not found: ${insurer}/${policy}` });
  }

  try {
    res.json(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch {
    res.status(500).json({ error: 'Failed to parse policy JSON' });
  }
});

// POST /api/policies/identify
// Body: { text: string }  (first ~20k chars of extracted PDF text)
// Returns: { matched: true, data: PolicyAnalysis }
//       or { matched: false, reason: string }
policiesRouter.post('/policies/identify', (req, res) => {
  const rawText: string = String(req.body?.text ?? '');
  const text: string = rawText.toLowerCase();

  if (text.length < 500) {
    return res.json({ matched: false, reason: 'Document too short — could not extract enough text.' });
  }

  // 1. Reject non-health documents
  const rejectHit = REJECT_KEYWORDS.find((k) => text.includes(k));
  if (rejectHit) {
    return res.json({
      matched: false,
      reason: `This appears to be a ${rejectHit} document, not a retail health insurance policy.`,
    });
  }

  // 2. Validate it's a health insurance policy wording
  const healthHits = HEALTH_KEYWORDS.filter((k) => text.includes(k)).length;
  if (healthHits < 3) {
    return res.json({
      matched: false,
      reason: 'This does not appear to be a health insurance policy document.',
    });
  }

  // 3. Identify insurer — pick the insurer whose longest pattern matches,
  // so "star health and allied insurance" (30 chars) beats "care health insurance"
  // (20 chars) when both appear in a Star Health document like "Special Care".
  let matchedInsurer: typeof INSURER_META[0] | null = null;
  let bestPatternLen = 0;
  for (const ins of INSURER_META) {
    for (const p of ins.patterns) {
      if (text.includes(p) && p.length > bestPatternLen) {
        matchedInsurer = ins;
        bestPatternLen = p.length;
      }
    }
  }

  if (!matchedInsurer) {
    return res.json({
      matched: false,
      reason: 'Insurer not recognised. We currently support Aditya Birla, Care, HDFC ERGO, ICICI Lombard, Niva Bupa, and Star Health.',
    });
  }

  // 4. Match policy name within that insurer
  const titleText = text.slice(0, 8_000);
  const candidates = loadAllPoliciesForInsurer(matchedInsurer.id);
  let best: { id: string; data: any; score: number } | null = null;

  for (const { id, data } of candidates) {
    const score = scoreMatch(titleText, text, data.policyName ?? id, id);
    console.log(`  [match] ${id}: ${score}`);
    if (!best || score > best.score) best = { id, data, score };
  }

  console.log(`[identify] best match: ${best?.id} (score=${best?.score})`);

  if (!best || best.score < 10) {
    // Insurer known but policy wording not matched — still return insurer so
    // frontend can show the selector pre-filled
    return res.json({
      matched: false,
      reason: `We identified this as a ${matchedInsurer.label} policy but could not match it to a specific product in our library.`,
      insurerId: matchedInsurer.id,
      insurerLabel: matchedInsurer.label,
    });
  }

  const customerInfo = extractCustomerInfo(rawText);
  res.json({ matched: true, insurerId: matchedInsurer.id, policyId: best.id, data: best.data, customerInfo });
});
