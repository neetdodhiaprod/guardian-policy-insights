import { ArrowRight, ShieldCheck, ShieldAlert, ShieldX, TrendingUp } from 'lucide-react';
import { V2Model } from '@/lib/v2Transform';
import { CustomerInfo } from '@/lib/mockData';

interface RecommendationSectionProps {
  model: V2Model;
  customerInfo?: CustomerInfo | null;
}

type Verdict = 'strong' | 'adequate' | 'gaps' | 'critical';

interface RecommendationContent {
  verdict: Verdict;
  headline: string;
  summary: string;
  bullets: string[];
  ctaLabel: string;
}

function buildBullets(model: V2Model, ci: CustomerInfo | null): string[] {
  const bullets: string[] = [];
  const coverAmount = ci?.sumInsured ? parseInt(ci.sumInsured) : null;
  const badNames = model.badCriticalFeatures.map(f => f.displayName);

  if (badNames.includes('Co-pay')) {
    bullets.push('At renewal, ask your insurer if a co-pay waiver rider is available — many offer it for an additional premium.');
  }
  if (badNames.includes('Room Rent')) {
    bullets.push('If hospitalised, choose a room within your policy\'s limit to avoid proportionate deductions across the entire bill.');
  }
  if (badNames.includes('Disease Sub-limits')) {
    bullets.push('Before a planned procedure, call your insurer to confirm the exact payout cap for that treatment.');
  }
  if (badNames.includes('PED Waiting Period')) {
    bullets.push('Do not file claims for pre-existing conditions until the waiting period is fully elapsed — rejections affect your claims history.');
  }

  // Low cover top-up nudge
  if (coverAmount !== null && coverAmount < 1000000) {
    const lakhs = (coverAmount / 100000).toFixed(0);
    bullets.push(`Your ₹${lakhs}L cover is below the ₹10–25L recommended for private hospital admissions in metros. A super top-up can extend this at low cost.`);
  }

  // Fallback generic bullets if nothing specific
  if (bullets.length === 0) {
    bullets.push('Review your policy terms annually — insurers sometimes adjust sub-limits and co-pay clauses at renewal.');
    bullets.push('Keep a digital copy of your policy document and share the key terms with your family.');
    bullets.push('If your income or family size changes, reassess whether your current sum insured is still adequate.');
  }

  return bullets.slice(0, 3);
}

function getRecommendation(model: V2Model, ci: CustomerInfo | null): RecommendationContent {
  const { shieldScore, badCriticalFeatures } = model;
  const coverAmount = ci?.sumInsured ? parseInt(ci.sumInsured) : null;
  const isLowCover = coverAmount !== null && coverAmount < 500000;
  const bullets = buildBullets(model, ci);

  if (badCriticalFeatures.length >= 2 || shieldScore < 40) {
    const names = badCriticalFeatures.slice(0, 2).map(f => f.displayName.toLowerCase());
    const nameStr = names.length >= 2 ? `${names[0]} and ${names[1]}` : names[0];
    return {
      verdict: 'critical',
      headline: 'Consider switching at renewal.',
      summary: `This policy has ${badCriticalFeatures.length} structural gaps — ${nameStr} will reduce your claim payout on most hospitalisations. You are paying full premium for partial coverage.`,
      bullets,
      ctaLabel: 'Compare better policies',
    };
  }

  if (badCriticalFeatures.length === 1 || shieldScore < 60) {
    const name = badCriticalFeatures[0]?.displayName ?? 'one clause';
    return {
      verdict: 'gaps',
      headline: `One fix could save you significantly.`,
      summary: `Your policy scores well overall. The ${name} clause is the primary risk — understanding it now means you will not be caught off-guard at claim time.`,
      bullets,
      ctaLabel: 'Talk to an advisor',
    };
  }

  if (isLowCover) {
    const lakhs = ((coverAmount ?? 0) / 100000).toFixed(0);
    return {
      verdict: 'adequate',
      headline: 'Good policy — your cover amount needs attention.',
      summary: `The policy structure is sound with no critical clause gaps. However, ₹${lakhs}L is below what a single serious illness or surgery costs at a private hospital today.`,
      bullets,
      ctaLabel: 'Explore top-up plans',
    };
  }

  return {
    verdict: 'strong',
    headline: 'Your policy is solid. Review at renewal.',
    summary: `No critical gaps found. You are well-covered for most hospitalisation scenarios. The main risk now is policy drift — insurers can adjust terms at renewal without much notice.`,
    bullets,
    ctaLabel: 'Explore upgrade options',
  };
}

const VERDICT_STYLE: Record<Verdict, {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string; iconColor: string;
  borderColor: string; headlineCls: string;
}> = {
  strong:   { icon: ShieldCheck,  iconBg: 'bg-great-bg',    iconColor: 'text-great-text',   borderColor: 'border-l-great-text',   headlineCls: 'text-foreground' },
  adequate: { icon: TrendingUp,   iconBg: 'bg-covered-bg',  iconColor: 'text-covered-text', borderColor: 'border-l-covered-text', headlineCls: 'text-foreground' },
  gaps:     { icon: ShieldAlert,  iconBg: 'bg-unclear-bg',  iconColor: 'text-unclear-text', borderColor: 'border-l-unclear-text', headlineCls: 'text-foreground' },
  critical: { icon: ShieldX,      iconBg: 'bg-bad-bg',      iconColor: 'text-bad-text',     borderColor: 'border-l-bad-text',     headlineCls: 'text-foreground' },
};

const RecommendationSection = ({ model, customerInfo }: RecommendationSectionProps) => {
  const ci = customerInfo ?? null;
  const rec = getRecommendation(model, ci);
  const s = VERDICT_STYLE[rec.verdict];
  const Icon = s.icon;

  return (
    <div className={`rounded-xl border border-border border-l-4 ${s.borderColor} shadow-card overflow-hidden bg-card`}>
      {/* Header */}
      <div className="px-6 py-5 border-b border-border bg-surface-sunken/30">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-sm flex-shrink-0 flex items-center justify-center ${s.iconBg} border border-border`}>
            <Icon className={`w-4 h-4 ${s.iconColor}`} />
          </div>
          <div>
            <p className="label-editorial text-muted-foreground">What You Should Do Next</p>
            <h3 className="font-display text-xl text-foreground leading-tight mt-0.5">{rec.headline}</h3>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-5 space-y-4">
        <p className="text-sm text-foreground/80 leading-relaxed">{rec.summary}</p>

        <ul className="space-y-2.5">
          {rec.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-[0.45rem] ${s.iconColor.replace('text-', 'bg-')}`} />
              <span className="text-sm text-foreground/70 leading-relaxed">{b}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="px-6 py-4 border-t border-border bg-surface-sunken/50 flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
          Free 15-min call. Our advisors have reviewed 100+ health policies across all major insurers.
        </p>
        <button className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-sm bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors">
          {rec.ctaLabel}
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default RecommendationSection;
