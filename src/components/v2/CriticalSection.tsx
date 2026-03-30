import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { V2Feature } from '@/lib/v2Transform';
import { VERDICT_META } from './VerdictCard';

type ResolvedFeature = V2Feature & { isPlaceholder?: boolean };

const CRITICAL_SLOTS: Array<{ displayName: string; matchKey: string; missingImpact: string }> = [
  {
    displayName: 'Co-pay',
    matchKey: 'co-pay',
    missingImpact: 'Co-pay terms not found in document — verify whether a percentage applies to every claim.',
  },
  {
    displayName: 'Room Rent',
    matchKey: 'room rent',
    missingImpact: 'Room rent limits not found — confirm whether exceeding a limit triggers proportionate deductions on the full bill.',
  },
  {
    displayName: 'Disease Sub-limits',
    matchKey: 'sub-limit',
    missingImpact: 'Sub-limit details not found — ask your insurer for the full list of procedures with capped payouts.',
  },
  {
    displayName: 'PED Waiting Period',
    matchKey: 'ped waiting',
    missingImpact: 'PED waiting period not found — confirm when pre-existing conditions become eligible for claims.',
  },
];

interface CriticalSectionProps {
  features: V2Feature[];
}

// ── Single critical factor card ───────────────────────────────────────────────

function CriticalFactorCard({ feature }: { feature: ResolvedFeature }) {
  const [open, setOpen] = useState(false);
  const m = VERDICT_META[feature.verdict];
  const Icon = m.icon;
  const isRisk     = feature.verdict === 'DANGER' && !feature.isPlaceholder;
  const hasQuote   = !feature.isPlaceholder && !!(feature.raw.quote || feature.raw.reference);
  const showAction = !feature.isPlaceholder
    && !!feature.actionRecommendation
    && (feature.verdict === 'DANGER' || feature.verdict === 'CHECK');

  return (
    <div
      className={`rounded-lg border flex flex-col gap-3 p-4 h-full ${m.cardBg} ${m.cardBorder}`}
      style={isRisk ? { borderTopWidth: '3px', borderTopColor: '#DC2626' } : undefined}
    >
      {/* Header: icon + name + pill */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className={`flex-shrink-0 ${m.iconClass} ${isRisk ? 'w-5 h-5' : 'w-4 h-4'}`} />
          <p className={`font-semibold text-foreground leading-snug ${isRisk ? 'text-base' : 'text-sm'}`}>
            {feature.displayName}
          </p>
        </div>
        <span className={`text-[10px] font-bold tracking-[0.08em] px-2 py-0.5 rounded-xs border flex-shrink-0 ${m.pillClass}`}>
          {m.label.toUpperCase()}
        </span>
      </div>

      {/* Impact statement — larger + darker text for DANGER to convey consequence */}
      <p className={`leading-relaxed ${isRisk ? 'text-sm text-foreground/80' : 'text-xs text-muted-foreground'}`}>
        {feature.impactStatement}
      </p>

      {/* Action callout — only DANGER/CHECK */}
      {showAction && (
        <div className="rounded-sm border-l-2 border-l-bad-text bg-surface-sunken px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-bad-text mb-1">What to do</p>
          <p className="text-xs text-foreground/80 leading-relaxed">{feature.actionRecommendation}</p>
        </div>
      )}

      {/* Policy wording — always visible for DANGER (evidence), toggle for others */}
      {hasQuote && isRisk ? (
        <div className="mt-auto rounded-sm border border-border-subtle bg-surface-sunken px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-1.5">From your policy</p>
          {feature.raw.quote && (
            <p className="text-xs text-foreground italic leading-relaxed line-clamp-3">"{feature.raw.quote}"</p>
          )}
          {feature.raw.reference && (
            <p className="text-[10px] text-muted-foreground mt-1">{feature.raw.reference}</p>
          )}
        </div>
      ) : hasQuote ? (
        <div className="mt-auto">
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
          >
            {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Show policy wording
          </button>
          {open && (
            <div className="mt-2 rounded-sm border border-border-subtle bg-surface-sunken px-3 py-2.5">
              {feature.raw.quote && (
                <p className="text-xs text-foreground italic leading-relaxed">"{feature.raw.quote}"</p>
              )}
              {feature.raw.reference && (
                <p className="text-xs text-muted-foreground mt-1">{feature.raw.reference}</p>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

const CriticalSection = ({ features }: CriticalSectionProps) => {
  const resolvedFeatures: ResolvedFeature[] = CRITICAL_SLOTS.map(slot => {
    const found = features.find(
      f => f.displayName === slot.displayName || f.raw.name.toLowerCase().includes(slot.matchKey),
    );
    if (found) return found;
    return {
      raw: { name: slot.displayName, explanation: slot.missingImpact, quote: null, reference: null },
      grade: 'unclear' as const,
      tier: 'critical' as const,
      weight: 3 as const,
      displayName: slot.displayName,
      icon: 'HelpCircle',
      verdict: 'CHECK' as const,
      impactStatement: slot.missingImpact,
      actionRecommendation: undefined,
      isPlaceholder: true,
    };
  });

  const dangerCount = resolvedFeatures.filter(f => f.verdict === 'DANGER' && !f.isPlaceholder).length;

  return (
    <div className="rounded-xl border border-border shadow-card overflow-hidden">
      {/* Section header */}
      <div className="px-6 py-5 border-b border-border bg-surface-sunken/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${dangerCount > 0 ? 'text-bad-text' : 'text-muted-foreground'}`} />
            <h3 className="font-display text-xl text-foreground">Key Policy Risks</h3>
          </div>
          {dangerCount > 0 ? (
            <span className="label-editorial text-bad-text flex-shrink-0">
              {dangerCount} risk{dangerCount > 1 ? 's' : ''} found
            </span>
          ) : (
            <span className="label-editorial text-great-text flex-shrink-0">No risks detected</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground pl-6 mt-1">
          The 4 critical clauses that determine your out-of-pocket costs when hospitalised
        </p>
      </div>

      {/*
        Layout logic:
        - DANGER items (real risks): span full width — they deserve full attention
        - Everything else: 2-column compact grid
      */}
      <div className="bg-card p-4 space-y-3">
        {/* Full-width DANGER items first */}
        {resolvedFeatures
          .filter(f => f.verdict === 'DANGER' && !f.isPlaceholder)
          .map((f, i) => (
            <CriticalFactorCard key={`danger-${i}`} feature={f} />
          ))
        }

        {/* Remaining items in 2-col grid */}
        {(() => {
          const rest = resolvedFeatures.filter(f => !(f.verdict === 'DANGER' && !f.isPlaceholder));
          if (rest.length === 0) return null;
          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {rest.map((f, i) => (
                <CriticalFactorCard key={`rest-${i}`} feature={f} />
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default CriticalSection;
