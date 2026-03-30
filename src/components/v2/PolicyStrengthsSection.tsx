import { useState } from 'react';
import { CheckCircle2, ShieldCheck, XCircle, AlertCircle, ChevronRight, ChevronDown, FileText } from 'lucide-react';
import { V2Model, FeatureGrade } from '@/lib/v2Transform';

interface Props {
  model: V2Model;
}

interface DisplayItem {
  grade: FeatureGrade;
  name: string;
  description: string;
  quote?: string | null;
  reference?: string | null;
}

function getDisplayItems(model: V2Model): DisplayItem[] {
  // Exclude critical tier — those features are shown in Key Policy Risks
  const classified = [...model.important, ...model.niceToHave].map(f => ({
    grade: f.grade,
    name: f.displayName,
    description: f.impactStatement,
    quote: f.raw.quote,
    reference: f.raw.reference,
  }));
  const unclassified = model.unclassified.map(u => ({
    grade: u.grade,
    name: u.feature.name,
    description: u.feature.explanation ?? '',
    quote: u.feature.quote,
    reference: u.feature.reference,
  }));
  return [...classified, ...unclassified];
}

function FeatureRow({ f, positiveIcon }: { f: DisplayItem; positiveIcon: boolean }) {
  const [open, setOpen] = useState(false);
  const hasWording = !!(f.quote || f.reference);

  return (
    <div className="py-3 border-b border-border/40 last:border-0">
      <div className="flex items-start gap-3">
        {positiveIcon
          ? <CheckCircle2 className={`w-4 h-4 flex-shrink-0 mt-0.5 ${f.grade === 'great' ? 'text-great-text' : 'text-covered-text'}`} />
          : f.grade === 'bad'
            ? <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-bad-text" />
            : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-unclear-text" />
        }
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-snug">{f.name}</p>
          {f.description && (
            <p className="text-xs text-muted-foreground leading-snug mt-0.5">{f.description}</p>
          )}
          {hasWording && (
            <div className="mt-2">
              <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <FileText className="w-3 h-3" />
                Show policy wording
              </button>
              {open && (
                <div className="mt-2 rounded-sm border border-border-subtle bg-surface-sunken px-3 py-2.5">
                  {f.quote && (
                    <p className="text-xs text-foreground italic leading-relaxed">"{f.quote}"</p>
                  )}
                  {f.reference && (
                    <p className="text-[10px] text-muted-foreground mt-1.5">{f.reference}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const PolicyStrengthsSection = ({ model }: Props) => {
  const strengths = getDisplayItems(model).filter(f => f.grade === 'great' || f.grade === 'good');
  if (strengths.length === 0) return null;

  return (
    <div className="rounded-xl border border-border shadow-card overflow-hidden bg-card">
      <div className="px-6 py-5 border-b border-border bg-surface-sunken/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-great-text flex-shrink-0" />
            <h3 className="font-display text-xl text-foreground">What Your Policy Does Well</h3>
          </div>
          <span className="label-editorial text-muted-foreground flex-shrink-0">
            {strengths.length} factor{strengths.length !== 1 ? 's' : ''}
          </span>
        </div>
        <p className="text-xs text-muted-foreground pl-6 mt-1">
          Clauses working in your favour — confirmed from your policy document
        </p>
      </div>

      <div className="bg-card px-6 py-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          {strengths.map((f, i) => (
            <FeatureRow key={i} f={f} positiveIcon={true} />
          ))}
        </div>
      </div>
    </div>
  );
};

export const PolicyWeaknessesSection = ({ model }: Props) => {
  const weaknesses = getDisplayItems(model).filter(f => f.grade === 'bad' || f.grade === 'unclear');
  if (weaknesses.length === 0) return null;

  return (
    <div className="rounded-xl border border-border shadow-card overflow-hidden bg-card">
      <div className="px-6 py-5 border-b border-border bg-surface-sunken/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-bad-text flex-shrink-0" />
            <h3 className="font-display text-xl text-foreground">What Your Policy Doesn't Do Well</h3>
          </div>
          <span className="label-editorial text-bad-text flex-shrink-0">
            {weaknesses.length} concern{weaknesses.length !== 1 ? 's' : ''}
          </span>
        </div>
        <p className="text-xs text-muted-foreground pl-6 mt-1">
          Clauses that may increase your out-of-pocket costs at claim time
        </p>
      </div>

      <div className="bg-card px-6 py-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          {weaknesses.map((f, i) => (
            <FeatureRow key={i} f={f} positiveIcon={false} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default PolicyStrengthsSection;
