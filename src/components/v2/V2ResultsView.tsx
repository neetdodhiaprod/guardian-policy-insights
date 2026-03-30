import { useState, useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { PolicyAnalysis } from '@/lib/mockData';
import { buildV2Model } from '@/lib/v2Transform';
import PolicyIdentityCard from './PolicyIdentityCard';
import InsurerCard from './InsurerCard';
import CriticalSection from './CriticalSection';
import RecommendationSection from './RecommendationSection';
import { PolicyStrengthsSection, PolicyWeaknessesSection } from './PolicyStrengthsSection';
import PolicyStoryModal from './PolicyStoryModal';
import PolicyIntroFlow from './PolicyIntroFlow';

const INSURER_COLORS: Record<string, string> = {
  'aditya-birla':     '#C9583A',
  'care':             '#C43040',
  'hdfc-ergo':        '#005084',
  'icici-lombard':    '#D4821A',
  'niva-bupa':        '#A82429',
  'star-health-care': '#1A638F',
};

interface V2ResultsViewProps {
  analysis: PolicyAnalysis;
  insurerId: string;
}

const V2ResultsView = ({ analysis, insurerId }: V2ResultsViewProps) => {
  const model = useMemo(() => buildV2Model(analysis), [analysis]);
  const ci = analysis.customerInfo ?? null;
  const insurerColor = INSURER_COLORS[insurerId] ?? '#64748b';
  const [showIntro, setShowIntro] = useState(true);
  const [showStory, setShowStory] = useState(false);

  if (showIntro) {
    return (
      <PolicyIntroFlow
        analysis={analysis}
        model={model}
        customerInfo={ci}
        onComplete={() => setShowIntro(false)}
      />
    );
  }

  const sections = [
    // 1. VERDICT
    <PolicyIdentityCard
      key="identity"
      analysis={analysis}
      model={model}
      insurerId={insurerId}
      insurerColor={insurerColor}
      customerInfo={ci}
    />,

    // 2. KEY POLICY RISKS — the 4 critical clauses
    <CriticalSection key="critical" features={model.critical} />,

    // 3. POLICY STRENGTHS — what's working in your favour
    <PolicyStrengthsSection key="strengths" model={model} />,

    // 4. POLICY WEAKNESSES — what's working against you
    <PolicyWeaknessesSection key="weaknesses" model={model} />,

    // 5. INSURER RELIABILITY
    <InsurerCard key="insurer" insurerId={insurerId} insurerColor={insurerColor} />,

    // 6. RECOMMENDATION CTA
    <RecommendationSection key="recommendation" model={model} customerInfo={ci} />,
  ].filter(Boolean);

  return (
    <>
      <div className="space-y-5">
        {/* Story trigger banner */}
        <button
          onClick={() => setShowStory(true)}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 rounded-xl border border-border bg-card hover:bg-surface-sunken/60 transition-colors shadow-card group"
          style={{ animation: 'enterUp 0.45s ease-out both' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-sm bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground leading-tight">Understand your policy in 60 seconds</p>
              <p className="text-xs text-muted-foreground mt-0.5">Plain-English breakdown of every clause that matters — no jargon</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-primary flex-shrink-0 group-hover:underline">
            See your story →
          </span>
        </button>

        {sections.map((section, i) => (
          <div
            key={i}
            style={{ animation: `enterUp 0.45s ease-out ${(i + 1) * 80}ms both` }}
          >
            {section}
          </div>
        ))}
      </div>

      {/* Story modal overlay */}
      {showStory && (
        <PolicyStoryModal
          analysis={analysis}
          model={model}
          insurerId={insurerId}
          customerInfo={ci}
          onClose={() => setShowStory(false)}
        />
      )}
    </>
  );
};

export default V2ResultsView;
