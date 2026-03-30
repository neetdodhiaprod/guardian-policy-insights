import { AlertTriangle, Target } from 'lucide-react';
import { V2Feature } from '@/lib/v2Transform';

interface ActionPlanFooterProps {
  badCriticalFeatures: V2Feature[];
  badImportantFeatures: V2Feature[];
}

function getTimeHorizon(f: V2Feature): string | null {
  const text = (f.actionRecommendation ?? '').toLowerCase();
  if (text.includes('renewal') || text.includes('switch') || text.includes('port')) return 'At renewal';
  if (text.includes('hospit') || text.includes('admission')) return 'Before hospitalisation';
  if (text.includes('immediately') || text.includes('contact insurer') || text.includes('contact your')) return 'Do it now';
  return null;
}

const ActionPlanFooter = ({ badCriticalFeatures, badImportantFeatures }: ActionPlanFooterProps) => {
  if (badCriticalFeatures.length === 0 && badImportantFeatures.length === 0) return null;

  const shownCritical  = [...badCriticalFeatures].sort((a, b) => b.weight - a.weight);
  const importantCap   = Math.max(0, 4 - shownCritical.length);
  const shownImportant = [...badImportantFeatures].sort((a, b) => b.weight - a.weight).slice(0, importantCap);
  const shown          = [...shownCritical, ...shownImportant];
  const remaining      = badImportantFeatures.length - shownImportant.length;

  return (
    <div className="bg-surface-sunken rounded-xl border border-border border-l-4 border-l-bad-text shadow-card p-6 md:p-8">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-8 h-8 rounded-sm bg-bad-bg border border-bad-border flex items-center justify-center flex-shrink-0">
          <Target className="w-4 h-4 text-bad-text" />
        </div>
        <h3 className="font-display text-xl text-foreground leading-tight">Your action plan</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-5 pl-[44px]">
        Resolve these before your next hospitalisation — listed by priority.
      </p>

      <ol className="space-y-5">
        {shown.map((f, i) => {
          const isCritical  = f.tier === 'critical';
          const horizon     = getTimeHorizon(f);
          return (
            <li key={i} className="flex gap-3 items-start">
              {/* Step circle — filled for critical, outlined for important */}
              <span className={`flex-shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center mt-0.5 ${
                isCritical
                  ? 'bg-bad-text text-white'
                  : 'bg-transparent border border-bad-border text-bad-text'
              }`}>
                {i + 1}
              </span>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="text-sm font-semibold text-foreground">{f.displayName}</p>
                  {isCritical && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.08em] px-2 py-0.5 rounded-xs bg-bad-bg text-bad-text border border-bad-border">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      CRITICAL
                    </span>
                  )}
                  {horizon && (
                    <span className="text-[10px] font-medium text-muted-foreground px-2 py-0.5 rounded-xs bg-surface-sunken border border-border">
                      {horizon}
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                  {f.impactStatement}
                </p>

                {f.actionRecommendation && (
                  <div className="rounded-sm bg-card border border-border px-3 py-2.5">
                    <p className="text-xs font-semibold text-foreground mb-1">What to do</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{f.actionRecommendation}</p>
                  </div>
                )}
              </div>
            </li>
          );
        })}

        {remaining > 0 && (
          <li className="pl-9">
            <p className="text-xs text-muted-foreground italic">
              + {remaining} more important factor{remaining > 1 ? 's' : ''} — scroll up to review them.
            </p>
          </li>
        )}
      </ol>

    </div>
  );
};

export default ActionPlanFooter;
