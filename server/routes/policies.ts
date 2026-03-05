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
  const text: string = String(req.body?.text ?? '').toLowerCase();

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

  res.json({ matched: true, insurerId: matchedInsurer.id, policyId: best.id, data: best.data });
});
