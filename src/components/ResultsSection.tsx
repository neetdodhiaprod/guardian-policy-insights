import { RefreshCw, ShieldCheck, ThumbsUp, AlertTriangle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import FeatureSection from "./FeatureSection";
import { PolicyAnalysis } from "@/lib/mockData";

interface ResultsSectionProps {
  analysis: PolicyAnalysis;
  onReset: () => void;
}

const SCORE_CONFIG = [
  { key: "great"   as const, label: "Best-in-class", icon: ShieldCheck,   bg: "bg-great/10",   ring: "bg-great",   text: "text-great"           },
  { key: "good"    as const, label: "Good",           icon: ThumbsUp,      bg: "bg-good/15",    ring: "bg-good",    text: "text-good-foreground"  },
  { key: "bad"     as const, label: "Red Flags",      icon: AlertTriangle, bg: "bg-bad/10",     ring: "bg-bad",     text: "text-bad"              },
  { key: "unclear" as const, label: "Unclear",        icon: HelpCircle,    bg: "bg-unclear/10", ring: "bg-unclear", text: "text-unclear"          },
];

const ResultsSection = ({ analysis, onReset }: ResultsSectionProps) => {
  const hasRedFlags = analysis.summary.bad > 0;

  return (
    <div className="animate-fade-in space-y-5">

      {/* Summary card */}
      <div className="bg-card rounded-2xl border border-border shadow-md p-6 md:p-8">
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-display text-2xl md:text-3xl text-foreground leading-tight mb-1">
                {analysis.policyName}
              </h2>
              <p className="text-sm text-muted-foreground">{analysis.insurer}</p>
              {analysis.policyType && analysis.policyType !== "Not specified" && (
                <span className="inline-block mt-2 text-xs font-medium bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
                  {analysis.policyType}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {SCORE_CONFIG.map(({ key, label, icon: Icon, bg, ring, text }) => (
            <div key={key} className={`${bg} rounded-xl p-4 text-center`}>
              <div className={`w-9 h-9 ${ring} rounded-lg flex items-center justify-center mx-auto mb-2`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <p className={`font-display text-2xl ${text}`}>{analysis.summary[key]}</p>
              <p className="font-body text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed breakdown — great first, then red flags */}
      <div className="bg-card rounded-2xl border border-border shadow-md p-6 md:p-8">
        <h3 className="font-display text-xl text-foreground mb-5">Detailed Breakdown</h3>
        <FeatureSection type="great"   features={analysis.features.great}   defaultOpen />
        <FeatureSection type="bad"     features={analysis.features.bad}     defaultOpen />
        <FeatureSection type="good"    features={analysis.features.good} />
        <FeatureSection type="unclear" features={analysis.features.unclear} />
      </div>

      {analysis.disclaimer && (
        <p className="text-xs text-muted-foreground text-center px-4">{analysis.disclaimer}</p>
      )}

      <div className="flex justify-center pt-2 pb-6">
        <Button onClick={onReset} variant="outline" size="lg" className="font-semibold gap-2">
          <RefreshCw className="w-4 h-4" />
          Analyse another policy
        </Button>
      </div>
    </div>
  );
};

export default ResultsSection;
