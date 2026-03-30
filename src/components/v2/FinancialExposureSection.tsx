import { IndianRupee, TrendingDown, CheckCircle2 } from 'lucide-react';
import { V2Model } from '@/lib/v2Transform';

interface FinancialExposureSectionProps {
  model: V2Model;
}

interface ExposureItem {
  featureName: string;
  description: string;
  addedCost: string;
}

// Exposure estimates based on industry-typical terms for each critical risk
const EXPOSURE_BY_FEATURE: Record<string, ExposureItem> = {
  'Co-pay': {
    featureName: 'Co-pay deduction',
    description: 'You pay a fixed % of every claim regardless of the reason for hospitalisation.',
    addedCost: '~₹40,000 on a ₹2L claim (20% co-pay)',
  },
  'Room Rent': {
    featureName: 'Room rent excess',
    description: 'Exceeding the room rent limit triggers proportionate deductions across your entire bill.',
    addedCost: '₹15,000–₹40,000 in additional deductions',
  },
  'Disease Sub-limits': {
    featureName: 'Disease sub-limit caps',
    description: 'Specific procedures like cataracts, joint replacement, or hernia are capped below actual cost.',
    addedCost: '₹20,000–₹60,000 uncovered for capped procedures',
  },
  'PED Waiting Period': {
    featureName: 'Pre-existing disease exclusion',
    description: 'Claims for conditions declared at policy start are rejected until the waiting period ends.',
    addedCost: 'Full claim amount rejected during waiting period',
  },
};

function estimateExposureRange(badCount: number, shieldScore: number): [number, number] {
  if (badCount >= 2 || shieldScore < 40) return [60000, 150000];
  if (badCount === 1)                    return [25000, 60000];
  if (shieldScore < 70)                  return [10000, 25000];
  return [5000, 15000];
}

function formatRupees(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${(n / 1000).toFixed(0)}K`;
}

const FinancialExposureSection = ({ model }: FinancialExposureSectionProps) => {
  const { badCriticalFeatures, shieldScore } = model;

  const [minExp, maxExp] = estimateExposureRange(badCriticalFeatures.length, shieldScore);

  const exposureItems: ExposureItem[] = badCriticalFeatures
    .map(f => EXPOSURE_BY_FEATURE[f.displayName])
    .filter((x): x is ExposureItem => !!x);

  const isLowRisk = badCriticalFeatures.length === 0;

  return (
    <div className="rounded-xl border border-border shadow-card overflow-hidden bg-card">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border bg-surface-sunken/30">
        <div className="flex items-center gap-2">
          <IndianRupee className={`w-4 h-4 flex-shrink-0 ${isLowRisk ? 'text-great-text' : 'text-bad-text'}`} />
          <h3 className="font-display text-xl text-foreground">Financial Risk</h3>
        </div>
        <p className="text-xs text-muted-foreground pl-6 mt-1">
          If you are hospitalised for ₹2L at a private hospital, how much comes out of your pocket?
        </p>
      </div>

      <div className="bg-card p-5 space-y-4">
        {/* Exposure range — the core product insight, impossible to miss */}
        <div className={`rounded-lg border p-6 text-center ${
          isLowRisk ? 'bg-great-bg border-great-border' : 'bg-bad-bg border-bad-border'
        }`}>
          <div className="flex justify-center mb-3">
            {isLowRisk
              ? <CheckCircle2 className="w-5 h-5 text-great-text" />
              : <TrendingDown className="w-5 h-5 text-bad-text" />
            }
          </div>
          <p className="label-editorial text-muted-foreground mb-3">
            {isLowRisk ? 'Estimated out-of-pocket' : 'You could pay out of pocket'}
          </p>
          <p
            className={`font-display font-tnum leading-none ${isLowRisk ? 'text-great-text' : 'text-bad-text'}`}
            style={{ fontSize: '3rem' }}
          >
            {formatRupees(minExp)} – {formatRupees(maxExp)}
          </p>
          {!isLowRisk && (
            <p className="text-xs text-muted-foreground mt-3">
              on a ₹2,00,000 total hospital bill
            </p>
          )}
        </div>

        {/* Disclaimer */}
        <p className="text-[10px] text-muted-foreground/60 leading-relaxed border-t border-border/40 pt-3">
          Estimates based on industry-typical terms. Actual deductions depend on your specific policy wording, hospital charges, and claim circumstances.
        </p>
      </div>
    </div>
  );
};

export default FinancialExposureSection;
