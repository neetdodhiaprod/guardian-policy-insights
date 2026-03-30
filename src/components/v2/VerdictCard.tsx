import { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, AlertTriangle, CheckCircle2, HelpCircle, Zap, ShieldCheck } from 'lucide-react';
import { V2Feature, Verdict } from '@/lib/v2Transform';

interface VerdictCardProps {
  feature: V2Feature;
  compact?: boolean;
}

export const VERDICT_META: Record<Verdict, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string; pillClass: string;
  cardBg: string; cardBorder: string;
  rowBorderClass: string; rowBg: string;
}> = {
  DANGER: {
    label: 'Concern',
    icon: AlertTriangle,
    iconClass: 'text-bad-text',
    pillClass: 'bg-bad-bg text-bad-text border-bad-border',
    cardBg: 'bg-bad-bg', cardBorder: 'border-bad-border',
    rowBorderClass: 'border-l-bad-text',
    rowBg: 'bg-bad-bg/50',
  },
  COVERED: {
    label: 'Adequate',
    icon: CheckCircle2,
    iconClass: 'text-covered-text',
    pillClass: 'bg-covered-bg text-covered-text border-covered-border',
    cardBg: 'bg-covered-bg', cardBorder: 'border-covered-border',
    rowBorderClass: 'border-l-covered-text',
    rowBg: '',
  },
  PROTECTED: {
    label: 'Excellent',
    icon: ShieldCheck,
    iconClass: 'text-great-text',
    pillClass: 'bg-great-bg text-great-text border-great-border',
    cardBg: 'bg-great-bg', cardBorder: 'border-great-border',
    rowBorderClass: 'border-l-great-text',
    rowBg: 'bg-great-bg/40',
  },
  CHECK: {
    label: 'Verify',
    icon: HelpCircle,
    iconClass: 'text-unclear-text',
    pillClass: 'bg-unclear-bg text-unclear-text border-unclear-border',
    cardBg: 'bg-unclear-bg', cardBorder: 'border-unclear-border',
    rowBorderClass: 'border-l-unclear-text',
    rowBg: '',
  },
};

function PolicyStates({ feature }: { feature: V2Feature }) {
  const [open, setOpen] = useState(false);
  if (!feature.raw.quote && !feature.raw.reference) return null;
  return (
    <div className="mt-2.5">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <FileText className="w-3 h-3" />
        Show policy wording
      </button>
      {open && (
        <div className="mt-2 rounded-sm border border-border-subtle bg-surface-sunken px-4 py-3">
          <div className="flex gap-2.5">
            <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              {feature.raw.quote && (
                <p className="text-sm text-foreground italic leading-relaxed">"{feature.raw.quote}"</p>
              )}
              {feature.raw.reference && (
                <p className="text-xs text-muted-foreground mt-1.5">{feature.raw.reference}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Full-width row with 3px left-border accent — used in Critical and Important section lists */
export function VerdictRow({ feature }: { feature: V2Feature }) {
  const m = VERDICT_META[feature.verdict];
  const Icon = m.icon;
  return (
    <div className={`py-4 pl-5 pr-6 border-l-[3px] ${m.rowBorderClass} ${m.rowBg}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2.5">
          <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${m.iconClass}`} />
          <p className="font-semibold text-[15px] text-foreground leading-snug">{feature.displayName}</p>
        </div>
        <span className={`text-[10px] font-bold tracking-[0.08em] px-2 py-0.5 rounded-xs border flex-shrink-0 mt-0.5 ${m.pillClass}`}>
          {m.label.toUpperCase()}
        </span>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed pl-[26px]">{feature.impactStatement}</p>

      {feature.verdict === 'PROTECTED' && feature.weight === 3 && (
        <div className="flex items-center gap-1.5 mt-2 pl-[26px]">
          <Zap className="w-3.5 h-3.5 text-great-text" />
          <span className="text-xs font-semibold text-great-text">Ahead of most policies on this</span>
        </div>
      )}

      {feature.actionRecommendation && (feature.verdict === 'DANGER' || feature.verdict === 'CHECK') && (
        <div className="mt-3 pl-[26px] flex items-start gap-2 p-3 rounded-sm bg-bad-bg border border-bad-border">
          <AlertTriangle className="w-3.5 h-3.5 text-bad-text flex-shrink-0 mt-0.5" />
          <p className="text-xs text-foreground leading-relaxed">{feature.actionRecommendation}</p>
        </div>
      )}

      <div className="pl-[26px]">
        <PolicyStates feature={feature} />
      </div>
    </div>
  );
}

/** Guardian editorial sub-header strip */
export function VerdictGroupHeader({ verdict: _verdict, count, label }: { verdict: Verdict; count: number; label?: string }) {
  return (
    <div className="px-6 py-2.5 bg-surface-sunken border-b border-border/60 flex items-center justify-between">
      <span className="label-editorial text-muted-foreground">{label ?? 'Factors'}</span>
      <span className="text-[10px] text-muted-foreground">{count} factor{count !== 1 ? 's' : ''}</span>
    </div>
  );
}

/** Compact tinted card — used in 2-col grids */
function CompactVerdictCard({ feature }: { feature: V2Feature }) {
  const m = VERDICT_META[feature.verdict];
  const Icon = m.icon;
  return (
    <div className={`rounded-lg border px-4 py-3 ${m.cardBg} ${m.cardBorder}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${m.iconClass}`} />
        <span className="font-semibold text-sm text-foreground flex-1 leading-snug">{feature.displayName}</span>
        <span className={`text-[10px] font-bold tracking-[0.08em] px-2 py-0.5 rounded-xs border flex-shrink-0 ${m.pillClass}`}>
          {m.label.toUpperCase()}
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed pl-5">{feature.impactStatement}</p>
      <div className="pl-5"><PolicyStates feature={feature} /></div>
    </div>
  );
}

const VerdictCard = ({ feature, compact = false }: VerdictCardProps) => {
  if (compact) return <CompactVerdictCard feature={feature} />;
  return <VerdictRow feature={feature} />;
};

export default VerdictCard;
