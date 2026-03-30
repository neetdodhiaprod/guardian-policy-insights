export type FeatureTier = 'critical' | 'important' | 'nicetohave';

export interface FeatureWeight {
  tier: FeatureTier;
  weight: 3 | 2 | 1;
  displayName: string;
  icon: string; // lucide-react icon name
  badImpact: string;
  goodImpact: string;
  actionIfBad: string;
}

// First match wins. Case-insensitive substring against feature.name.
const WEIGHT_RULES: Array<{ match: string; config: FeatureWeight }> = [
  // ── CRITICAL (weight 3) ──────────────────────────────────────────
  {
    match: 'co-pay',
    config: {
      tier: 'critical', weight: 3,
      displayName: 'Co-pay',
      icon: 'CircleDollarSign',
      badImpact: 'You pay a percentage of every hospital bill out of your own pocket — even after your insurance kicks in.',
      goodImpact: 'No co-pay clause — the insurer covers 100% of admissible claims.',
      actionIfBad: "At renewal, ask your insurer for a 'co-pay waiver' add-on. If unavailable, compare porting to HDFC Optima Secure, Care Supreme, or Niva Bupa ReAssure — all offer zero co-pay options. IRDAI portability rules mean you carry forward waiting periods already served.",
    },
  },
  {
    match: 'room rent',
    config: {
      tier: 'critical', weight: 3,
      displayName: 'Room Rent',
      icon: 'BedDouble',
      badImpact: 'A room-rent cap can proportionately reduce your entire claim — not just the room cost.',
      goodImpact: 'No room-rent cap — your full sum insured applies regardless of room type.',
      actionIfBad: "Before any admission, call your insurer and ask: 'What is my room rent limit and will exceeding it trigger a proportionate deduction on all other charges?' This single question can save you lakhs. If the answer is yes, stay within your eligible room category.",
    },
  },
  {
    match: 'disease sub-limit',
    config: {
      tier: 'critical', weight: 3,
      displayName: 'Disease Sub-limits',
      icon: 'Slice',
      badImpact: 'Specific conditions (e.g. cataract, joint replacement) have hard rupee caps well below your sum insured.',
      goodImpact: 'No disease-specific sub-limits — your full sum insured is available for any illness.',
      actionIfBad: "Ask your insurer for the complete list of sub-limited procedures in writing. For any planned procedure (cataract, joint replacement, hernia), verify the sub-limit against current hospital rates in your city before scheduling. For future renewals, look for plans with no sub-limits.",
    },
  },
  {
    match: 'ped waiting',
    config: {
      tier: 'critical', weight: 3,
      displayName: 'PED Waiting Period',
      icon: 'Clock',
      badImpact: 'Pre-existing conditions are excluded for an extended period, leaving you exposed when you need cover most.',
      goodImpact: 'Short PED waiting period — pre-existing conditions become eligible sooner.',
      actionIfBad: "IRDAI portability rules let you carry forward the waiting period already served — you don't restart the clock if you port. If you have a declared pre-existing condition, check exactly when it becomes covered and make a calendar reminder. For undisclosed conditions, non-disclosure could void future claims entirely.",
    },
  },

  // ── IMPORTANT (weight 2) ─────────────────────────────────────────
  {
    match: 'restore',
    config: {
      tier: 'important', weight: 2,
      displayName: 'Restoration / Refill',
      icon: 'RefreshCw',
      badImpact: 'Limited or restricted restore means a bad claim year can exhaust your entire cover.',
      goodImpact: 'Sum insured is refilled after a claim — you stay protected even in a difficult year.',
      actionIfBad: "Consider adding a super top-up plan (e.g., ₹20L with a ₹5L deductible) to cover you if your base sum insured runs out. Most super top-ups cost ₹3,000–₹8,000/year for ages under 45. The base + top-up combination gives better value than buying a single high-cover plan.",
    },
  },
  {
    match: 'no claim bonus',
    config: {
      tier: 'important', weight: 2,
      displayName: 'No-Claim Bonus',
      icon: 'TrendingUp',
      badImpact: 'NCB resets or drops sharply after a claim — you lose accumulated cover built over healthy years.',
      goodImpact: 'NCB accrues and is protected — your cover grows meaningfully in claim-free years.',
      actionIfBad: "Ask your insurer specifically: 'Does my NCB reset to zero after one claim, or does it reduce incrementally?' A full reset means a single claim wipes years of built-up cover. Plans with incremental NCB reduction (e.g., reduce by 10% per claim rather than to zero) are significantly better.",
    },
  },
  {
    match: 'ncb',
    config: {
      tier: 'important', weight: 2,
      displayName: 'No-Claim Bonus',
      icon: 'TrendingUp',
      badImpact: 'NCB resets or drops sharply after a claim — you lose accumulated cover built over healthy years.',
      goodImpact: 'NCB accrues and is protected — your cover grows meaningfully in claim-free years.',
      actionIfBad: "Ask your insurer specifically: 'Does my NCB reset to zero after one claim, or does it reduce incrementally?' A full reset means a single claim wipes years of built-up cover. Plans with incremental NCB reduction are significantly better.",
    },
  },
  {
    match: 'post-hospitalization',
    config: {
      tier: 'important', weight: 2,
      displayName: 'Post-hospitalisation Cover',
      icon: 'CalendarCheck',
      badImpact: 'A short post-discharge window leaves follow-up consultations and medicines out of pocket.',
      goodImpact: 'Extended post-discharge cover — follow-up costs are reimbursed well after you leave hospital.',
      actionIfBad: 'Keep all post-discharge receipts within the covered window and submit them.',
    },
  },
  {
    match: 'pre-hospitalization',
    config: {
      tier: 'important', weight: 2,
      displayName: 'Pre-hospitalisation Cover',
      icon: 'CalendarClock',
      badImpact: 'Short pre-admission window means diagnostic tests and consultations come out of pocket.',
      goodImpact: 'Pre-admission costs covered — diagnostics leading to hospitalisation are reimbursed.',
      actionIfBad: 'Retain all diagnostic receipts from the period covered by your policy.',
    },
  },
  {
    match: 'day care',
    config: {
      tier: 'important', weight: 2,
      displayName: 'Day Care Procedures',
      icon: 'Stethoscope',
      badImpact: 'Day care gaps mean modern short-stay procedures may not be reimbursed.',
      goodImpact: 'All day care procedures covered — no 24-hour admission requirement.',
      actionIfBad: 'Confirm specific procedures with your insurer before scheduling day care treatment.',
    },
  },

  // ── NICE-TO-HAVE (weight 1) ──────────────────────────────────────
  {
    match: 'maternity',
    config: {
      tier: 'nicetohave', weight: 1,
      displayName: 'Maternity',
      icon: 'Baby',
      badImpact: 'Maternity costs come entirely out of pocket.',
      goodImpact: 'Maternity covered with reasonable limits.',
      actionIfBad: 'Budget ₹1–3L separately for delivery costs.',
    },
  },
  {
    match: 'ayush',
    config: {
      tier: 'nicetohave', weight: 1,
      displayName: 'AYUSH Treatment',
      icon: 'Leaf',
      badImpact: 'Alternative medicine treatments are excluded.',
      goodImpact: 'AYUSH treatments covered.',
      actionIfBad: 'Budget separately if you rely on Ayurveda, Yoga, Unani, Siddha, or Homeopathy.',
    },
  },
  {
    match: 'mental health',
    config: {
      tier: 'nicetohave', weight: 1,
      displayName: 'Mental Health',
      icon: 'Brain',
      badImpact: 'Mental health treatment is not clearly covered.',
      goodImpact: 'Mental health coverage is present.',
      actionIfBad: 'Verify specific conditions covered in writing with your insurer.',
    },
  },
  {
    match: 'opd',
    config: {
      tier: 'nicetohave', weight: 1,
      displayName: 'OPD Cover',
      icon: 'Clipboard',
      badImpact: 'Out-patient visits and consultations are not covered.',
      goodImpact: 'OPD coverage included — consultations and medicines reimbursed.',
      actionIfBad: 'Budget ₹10,000–₹30,000/year for out-patient costs.',
    },
  },
  {
    match: 'domiciliary',
    config: {
      tier: 'nicetohave', weight: 1,
      displayName: 'Domiciliary / Home Care',
      icon: 'Home',
      badImpact: 'Home-based treatment is excluded or restricted.',
      goodImpact: 'Home-based hospitalisation is covered.',
      actionIfBad: 'Get approval from your insurer before starting any home treatment.',
    },
  },
];

export function getFeatureWeight(featureName: string): FeatureWeight | null {
  const lower = featureName.toLowerCase();
  for (const rule of WEIGHT_RULES) {
    if (lower.includes(rule.match)) return rule.config;
  }
  return null;
}
