import { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Layers } from 'lucide-react';
import { V2Feature, UnclassifiedFeature, FeatureGrade, Verdict } from '@/lib/v2Transform';
import { VerdictRow, VERDICT_META } from './VerdictCard';

interface NiceToHaveSectionProps {
  features: V2Feature[];
  unclassified: UnclassifiedFeature[];
}

const GRADE_TO_VERDICT: Record<FeatureGrade, Verdict> = {
  great:   'PROTECTED',
  good:    'COVERED',
  bad:     'DANGER',
  unclear: 'CHECK',
};

function UnclassifiedRow({ item }: { item: UnclassifiedFeature }) {
  const [open, setOpen] = useState(false);
  const hasQuote = !!(item.feature.quote || item.feature.reference);
  const m = VERDICT_META[GRADE_TO_VERDICT[item.grade]];

  return (
    <div className={`py-4 pl-5 pr-6 border-l-[3px] ${m.rowBorderClass}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="font-semibold text-[15px] text-foreground leading-snug">{item.feature.name}</span>
        <span className={`text-[10px] font-bold tracking-[0.08em] px-2 py-0.5 rounded-xs border flex-shrink-0 mt-0.5 ${m.pillClass}`}>
          {m.label.toUpperCase()}
        </span>
      </div>
      {item.feature.explanation && (
        <p className="text-sm text-muted-foreground leading-relaxed">{item.feature.explanation}</p>
      )}
      {hasQuote && (
        <div className="mt-2.5">
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <FileText className="w-3 h-3" />
            Show policy wording
          </button>
          {open && (
            <div className="mt-2 rounded-sm border border-border-subtle bg-surface-sunken px-4 py-3">
              <div className="flex gap-2.5">
                <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  {item.feature.quote && (
                    <p className="text-sm text-foreground italic leading-relaxed">"{item.feature.quote}"</p>
                  )}
                  {item.feature.reference && (
                    <p className="text-xs text-muted-foreground mt-1.5">{item.feature.reference}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const NiceToHaveSection = ({ features, unclassified }: NiceToHaveSectionProps) => {
  const [open, setOpen] = useState(false);
  const total = features.length + unclassified.length;
  if (total === 0) return null;

  const allGrades = [...features.map(f => f.grade), ...unclassified.map(u => u.grade)];
  const concerns  = allGrades.filter(g => g === 'bad' || g === 'unclear').length;

  return (
    <div className="rounded-xl border border-border shadow-card overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-6 py-4 hover:bg-surface-sunken/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <div className="text-left">
            <span className="font-display text-lg text-foreground">Full Coverage Details</span>
            <span className="text-xs text-muted-foreground ml-2">{total} detail{total !== 1 ? 's' : ''}</span>
            {!open && concerns > 0 && (
              <span className="ml-1 text-[11px] font-semibold text-bad-text">· {concerns} concern{concerns !== 1 ? 's' : ''}</span>
            )}
            {!open && concerns === 0 && total > 0 && (
              <span className="ml-1 text-[11px] text-muted-foreground">· all clear</span>
            )}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {features.length > 0 && (
            <div className="border-t border-border/60">
              <div className="px-6 py-2.5 bg-surface-sunken border-b border-border/60 flex items-center justify-between">
                <span className="label-editorial text-muted-foreground">All Policy Clauses</span>
                <span className="text-[10px] text-muted-foreground">{features.length} factor{features.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="bg-card divide-y divide-border/60">
                {features.map((f, i) => <VerdictRow key={i} feature={f} />)}
              </div>
            </div>
          )}

          {unclassified.length > 0 && (
            <div className="border-t border-border/60">
              <div className="px-6 py-2.5 bg-surface-sunken border-b border-border/60 flex items-center justify-between">
                <span className="label-editorial text-muted-foreground">Coverage Details</span>
                <span className="text-[10px] text-muted-foreground">{unclassified.length} detail{unclassified.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="bg-card divide-y divide-border/60">
                {unclassified.map((item, i) => <UnclassifiedRow key={i} item={item} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default NiceToHaveSection;
