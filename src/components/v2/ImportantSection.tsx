import { useState } from 'react';
import { ListChecks, ChevronDown } from 'lucide-react';
import { V2Feature, Verdict } from '@/lib/v2Transform';
import { VerdictRow, VERDICT_META } from './VerdictCard';

const VERDICT_ORDER: Verdict[] = ['DANGER', 'CHECK', 'COVERED', 'PROTECTED'];

interface ImportantSectionProps {
  features: V2Feature[];
}

const ImportantSection = ({ features }: ImportantSectionProps) => {
  // Auto-expand positive factors when nothing needs attention — users deserve to see their wins
  const [goodExpanded, setGoodExpanded] = useState(
    () => features.filter(f => f.grade === 'bad' || f.grade === 'unclear').length === 0,
  );

  if (features.length === 0) return null;

  const needsAttention = features.filter(f => f.grade === 'bad' || f.grade === 'unclear');
  const lookingGood    = features.filter(f => f.grade === 'great' || f.grade === 'good');

  const sortedAttention = VERDICT_ORDER.flatMap(v => needsAttention.filter(f => f.verdict === v));
  const sortedGood      = VERDICT_ORDER.flatMap(v => lookingGood.filter(f => f.verdict === v));

  return (
    <div className="rounded-xl border border-border shadow-card overflow-hidden">
      {/* Section header */}
      <div className="px-6 py-5 border-b border-border bg-surface-sunken/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-primary flex-shrink-0" />
            <h3 className="font-display text-xl text-foreground">Coverage Check</h3>
          </div>
          {sortedAttention.length > 0 ? (
            <span className="label-editorial text-bad-text flex-shrink-0">
              {sortedAttention.length} to review
            </span>
          ) : (
            <span className="label-editorial text-muted-foreground flex-shrink-0">{features.length} factor{features.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground pl-6 mt-1">
          Secondary clauses that affect specific hospitalisation scenarios
        </p>
      </div>

      {/* Needs attention — full verdict rows */}
      {sortedAttention.length > 0 && (
        <>
          <div className="px-6 py-2.5 bg-surface-sunken border-b border-border/60 flex items-center justify-between">
            <span className="label-editorial text-bad-text">Needs attention</span>
            <span className="text-[10px] text-muted-foreground">{sortedAttention.length} factor{sortedAttention.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="bg-card divide-y divide-border/60">
            {sortedAttention.map((f, i) => <VerdictRow key={i} feature={f} />)}
          </div>
        </>
      )}

      {/* What's working well — compact checklist */}
      {sortedGood.length > 0 && (
        <>
          <button
            onClick={() => setGoodExpanded(x => !x)}
            className={`w-full px-6 py-2.5 bg-surface-sunken flex items-center justify-between hover:bg-muted/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${sortedAttention.length > 0 ? 'border-t border-border/60' : ''}`}
          >
            <span className="label-editorial text-muted-foreground">What's working well</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">{sortedGood.length} factor{sortedGood.length !== 1 ? 's' : ''}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${goodExpanded ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {goodExpanded && (
            <div className="bg-card border-t border-border/60 animate-expand-in">
              <div className="px-6 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                {sortedGood.map((f, i) => {
                  const m = VERDICT_META[f.verdict];
                  const Icon = m.icon;
                  return (
                    <div key={i} className="flex items-center gap-2.5 py-2.5 border-b border-border/40 last:border-0">
                      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${m.iconClass}`} />
                      <span className="text-sm text-foreground flex-1 leading-snug">{f.displayName}</span>
                      <span className={`text-[10px] font-bold tracking-[0.06em] px-1.5 py-0.5 rounded-xs border flex-shrink-0 ${m.pillClass}`}>
                        {m.label.toUpperCase()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ImportantSection;
