// Premium and coverage benchmarks for Indian health insurance

// Per-lakh-of-SI annual premium ranges by age band (individual, base policy)
export const PREMIUM_BENCHMARKS: Array<{
  minAge: number;
  maxAge: number;
  perLakhMin: number;
  perLakhMax: number;
}> = [
  { minAge: 18, maxAge: 30, perLakhMin: 200,  perLakhMax: 450  },
  { minAge: 31, maxAge: 40, perLakhMin: 320,  perLakhMax: 700  },
  { minAge: 41, maxAge: 50, perLakhMin: 650,  perLakhMax: 1300 },
  { minAge: 51, maxAge: 60, perLakhMin: 1100, perLakhMax: 2200 },
  { minAge: 61, maxAge: 70, perLakhMin: 2000, perLakhMax: 4500 },
  { minAge: 71, maxAge: 99, perLakhMin: 3500, perLakhMax: 7500 },
];

// Minimum recommended sum insured by city tier
export const COVERAGE_MINIMUMS: Record<string, number> = {
  Tier1:  1_000_000,  // ₹10L
  Tier2:  500_000,    // ₹5L
  Tier3:  300_000,    // ₹3L
};

// Fallback city → tier mapping (when premiumTier field not present in doc)
const METRO_CITIES = new Set([
  'delhi', 'new delhi', 'mumbai', 'bangalore', 'bengaluru',
  'chennai', 'hyderabad', 'kolkata', 'pune', 'ahmedabad',
]);
const TIER1_CITIES = new Set([
  'surat', 'jaipur', 'lucknow', 'kanpur', 'nagpur', 'indore',
  'thane', 'bhopal', 'visakhapatnam', 'vadodara', 'kochi',
  'coimbatore', 'patna', 'chandigarh', 'gurgaon', 'noida',
]);

export function resolveTier(premiumTier: string | null, city: string | null): string {
  // Use the explicit tier from policy document if present (e.g. HDFC ERGO)
  if (premiumTier) {
    const t = premiumTier.trim();
    if (/tier\s*1/i.test(t)) return 'Tier1';
    if (/tier\s*2/i.test(t)) return 'Tier2';
    if (/tier\s*3/i.test(t)) return 'Tier3';
  }
  // Fall back to city name lookup
  if (city) {
    const lower = city.toLowerCase().trim();
    if (METRO_CITIES.has(lower)) return 'Tier1';
    if (TIER1_CITIES.has(lower)) return 'Tier2';
  }
  return 'Tier2'; // safe default
}

export type PremiumVerdict = 'FAIR' | 'OVERPAYING' | 'UNDERPAYING' | 'UNKNOWN';
export type CoverageVerdict = 'ADEQUATE' | 'LOW' | 'UNKNOWN';

/**
 * Assess whether the premium is reasonable.
 * totalPremium and sumInsured are raw digit strings (e.g. "28534", "2500000").
 * memberCount: normalise per person for family floaters.
 */
export function assessPremium(
  totalPremium: string | null,
  age: number | null,
  sumInsured: string | null,
  memberCount: number = 1,
): PremiumVerdict {
  if (!totalPremium || !age || !sumInsured) return 'UNKNOWN';

  const prem = parseFloat(totalPremium);
  const si = parseFloat(sumInsured);
  if (isNaN(prem) || isNaN(si) || si === 0) return 'UNKNOWN';

  // Normalise premium per person
  const premPerPerson = prem / Math.max(memberCount, 1);
  const siInLakhs = si / 100_000;

  const band = PREMIUM_BENCHMARKS.find(b => age >= b.minAge && age <= b.maxAge);
  if (!band) return 'UNKNOWN';

  const expectedMin = band.perLakhMin * siInLakhs;
  const expectedMax = band.perLakhMax * siInLakhs;

  // Allow ±40% tolerance for product quality differences (e.g. Optima Secure vs basic plan)
  if (premPerPerson < expectedMin * 0.6) return 'UNDERPAYING';
  if (premPerPerson > expectedMax * 1.4) return 'OVERPAYING';
  return 'FAIR';
}

/**
 * Assess whether the sum insured is adequate.
 * sumInsured is a raw digit string (e.g. "2500000").
 */
export function assessCoverage(
  sumInsured: string | null,
  premiumTier: string | null,
  city: string | null,
): CoverageVerdict {
  if (!sumInsured) return 'UNKNOWN';
  const si = parseFloat(sumInsured);
  if (isNaN(si)) return 'UNKNOWN';
  const tier = resolveTier(premiumTier, city);
  const min = COVERAGE_MINIMUMS[tier] ?? COVERAGE_MINIMUMS['Tier2'];
  return si >= min ? 'ADEQUATE' : 'LOW';
}

/** Format raw digit string as Indian currency display */
export function formatINR(raw: string | null): string | null {
  if (!raw) return null;
  const n = parseFloat(raw);
  if (isNaN(n)) return null;
  if (n >= 10_00_000) return `₹${(n / 1_00_000).toFixed(0)} Lakhs`;
  if (n >= 1_00_000)  return `₹${(n / 1_00_000).toFixed(1)} Lakh`;
  return `₹${n.toLocaleString('en-IN')}`;
}
