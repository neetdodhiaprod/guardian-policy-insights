import fs from 'fs';
import path from 'path';

// Key features to check presence of, with keyword matchers
const FEATURES = [
  { key: 'room_rent',            label: 'Room Rent',             keywords: ['room rent'] },
  { key: 'proportionate',        label: 'Proportionate Ded.',    keywords: ['proportionate'] },
  { key: 'ped_waiting',          label: 'PED Waiting',           keywords: ['pre-existing', 'ped'] },
  { key: 'specific_illness',     label: 'Specific Illness Wait', keywords: ['specific', 'listed condition'] },
  { key: 'initial_waiting',      label: 'Initial Waiting',       keywords: ['initial waiting', 'first 30', '30 days from'] },
  { key: 'pre_hosp',             label: 'Pre-Hosp',              keywords: ['pre-hospitalization', 'pre-hosp'] },
  { key: 'post_hosp',            label: 'Post-Hosp',             keywords: ['post-hospitalization', 'post-hosp'] },
  { key: 'copay',                label: 'Co-pay',                keywords: ['co-pay', 'copay', 'co pay', 'co-payment', 'copayment'] },
  { key: 'restore',              label: 'Restore Benefit',       keywords: ['restore', 'restoration'] },
  { key: 'ncb',                  label: 'NCB / Renewal Bonus',   keywords: ['ncb', 'no claim bonus', 'renewal bonus', 'plus benefit', 'cumulative bonus', 'bonus'] },
  { key: 'si_buffer',            label: 'Built-in SI Buffer',    keywords: ['secure benefit', 'super ncb', 'enhanced si', 'additional sum insured', 'si buffer', 'extra sum insured', 'booster'] },
  { key: 'air_ambulance',        label: 'Air Ambulance',         keywords: ['air ambulance'] },
  { key: 'domiciliary',          label: 'Domiciliary',           keywords: ['domiciliary'] },
  { key: 'modern_treatments',    label: 'Modern Treatments',     keywords: ['modern treatment', 'advanced treatment', 'robotic', 'oral chemo'] },
  { key: 'consumables',          label: 'Consumables',           keywords: ['consumable', 'non-medical expense'] },
];

// Rule violations to check
const RULES = [
  {
    label: 'PED in BAD (should be GOOD if ≤48m)',
    check: (data) => data.features.bad?.some(f =>
      matches(f, ['pre-existing', 'ped']) && !textContains(f, ['60 month', '5 year', '72 month'])
    ),
  },
  {
    label: 'Specific illness in BAD (should be GOOD if 24m)',
    check: (data) => data.features.bad?.some(f =>
      matches(f, ['specific', 'listed condition']) && textContains(f, ['24 month', '2 year'])
    ),
  },
  {
    label: 'Single AC room in GREAT (should be GOOD)',
    check: (data) => data.features.great?.some(f =>
      matches(f, ['room rent']) && textContains(f, ['single private ac', 'single ac room', 'single private room'])
    ),
  },
  {
    label: 'Room rent in multiple categories',
    check: (data) => {
      const cats = ['great', 'good', 'bad', 'unclear'];
      // Exclude proportionate deduction entries — they mention "room rent" but are a separate feature
      const found = cats.filter(c => data.features[c]?.some(f =>
        matches(f, ['room rent']) && !matches(f, ['proportionate', 'ratable', 'pro-rata'])
      ));
      return found.length > 1;
    },
  },
  {
    label: 'Summary count mismatch',
    check: (data) => {
      const cats = ['great', 'good', 'bad', 'unclear'];
      return cats.some(c => (data.summary?.[c] ?? 0) !== (data.features[c]?.length ?? 0));
    },
  },
  {
    label: 'Proportionate in BAD with At-Actuals room',
    check: (data) => {
      // Only flag if room rent is UNCONDITIONALLY at-actuals (no plan/schedule/SI conditions)
      const hasAtActualsInGreat = data.features.great?.some(f =>
        matches(f, ['room rent']) &&
        textContains(f, ['at actuals', 'any room', 'no limit', 'no capping']) &&
        !textContains(f, ['unless', 'schedule', 'lakhs and above', 'plan variant', 'sub-plan', 'si of'])
      );
      // Skip if proportionate entry itself says it's schedule/plan-conditional
      const propInBad = data.features.bad?.some(f =>
        matches(f, ['proportionate']) &&
        !textContains(f, ['policy schedule', 'eligible room category', 'plan tier', 'sub-plan'])
      );
      return hasAtActualsInGreat && propInBad;
    },
  },
];

function textContains(feature, keywords) {
  const text = `${feature.name} ${feature.explanation} ${feature.quote}`.toLowerCase();
  return keywords.some(k => text.includes(k.toLowerCase()));
}

function matches(feature, keywords) {
  const text = `${feature.name} ${feature.explanation}`.toLowerCase();
  return keywords.some(k => {
    // Use word-boundary matching for short keywords to avoid substring false positives
    if (k.length <= 4) return new RegExp(`\\b${k.toLowerCase()}\\b`).test(text);
    return text.includes(k.toLowerCase());
  });
}

function findFeatureCategory(data, featureDef) {
  for (const cat of ['great', 'good', 'bad', 'unclear']) {
    if (data.features[cat]?.some(f => matches(f, featureDef.keywords))) {
      return cat.toUpperCase().slice(0, 1); // G, G, B, U
    }
  }
  return 'MISSING';
}

// Collect all JSON files
function getAllJsons(dir) {
  const results = [];
  for (const insurer of fs.readdirSync(dir).sort()) {
    const insurerPath = path.join(dir, insurer);
    if (!fs.statSync(insurerPath).isDirectory()) continue;
    for (const file of fs.readdirSync(insurerPath).sort()) {
      if (file.endsWith('.json')) {
        results.push({ insurer, file, fullPath: path.join(insurerPath, file) });
      }
    }
  }
  return results;
}

const jsons = getAllJsons('out');
console.log(`Checking ${jsons.length} policy JSONs...\n`);

// Build CSV
const headers = ['Insurer', 'Policy', ...FEATURES.map(f => f.label), 'RULE VIOLATIONS'];
const rows = [headers];

const violations = [];

for (const { insurer, file, fullPath } of jsons) {
  const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const policyName = file.replace('.json', '');

  // Feature presence
  const featureCols = FEATURES.map(f => {
    const cat = findFeatureCategory(data, f);
    // Map to readable value
    if (cat === 'G') {
      // Distinguish GREAT vs GOOD by checking which array
      for (const c of ['great', 'good', 'bad', 'unclear']) {
        if (data.features[c]?.some(item => matches(item, f.keywords))) {
          return c === 'great' ? '★GREAT' : c === 'good' ? 'good' : c === 'bad' ? '✗BAD' : '?unclear';
        }
      }
    }
    return cat === 'MISSING' ? '' : cat;
  });

  // Rule checks
  const ruleViolations = RULES
    .filter(r => { try { return r.check(data); } catch { return false; } })
    .map(r => r.label);

  if (ruleViolations.length) {
    violations.push({ policy: `${insurer}/${policyName}`, violations: ruleViolations });
  }

  rows.push([insurer, policyName, ...featureCols, ruleViolations.join(' | ')]);
}

// Write CSV
const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
fs.writeFileSync('out/verification_matrix.csv', csv);
console.log(`✓ Saved out/verification_matrix.csv`);

// Print rule violations summary
if (violations.length === 0) {
  console.log('\n✓ No rule violations found across all policies.');
} else {
  console.log(`\n⚠ Rule violations found in ${violations.length} policies:\n`);
  for (const v of violations) {
    console.log(`  ${v.policy}`);
    for (const viol of v.violations) console.log(`    → ${viol}`);
  }
}

// Print completeness summary
console.log('\n--- FEATURE COMPLETENESS ---');
for (const feat of FEATURES) {
  const missing = jsons.filter(({ fullPath }) => {
    const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    return findFeatureCategory(data, feat) === 'MISSING';
  });
  const pct = Math.round(((jsons.length - missing.length) / jsons.length) * 100);
  const bar = missing.length > 0 ? `  ← missing in ${missing.length}: ${missing.slice(0,3).map(j => j.file.replace('.json','')).join(', ')}${missing.length > 3 ? '...' : ''}` : '';
  console.log(`  ${feat.label.padEnd(25)} ${pct}%${bar}`);
}
