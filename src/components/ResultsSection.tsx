import { useState } from "react";
import { RefreshCw, ShieldCheck, ThumbsUp, AlertTriangle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import FeatureSection from "./FeatureSection";
import { PolicyAnalysis } from "@/lib/mockData";
import V2ResultsView from "./v2/V2ResultsView";

interface ResultsSectionProps {
  analysis: PolicyAnalysis;
  insurerId: string;
  onReset: () => void;
}

const SCORE_CONFIG = [
  { key: "great"   as const, label: "Best-in-class", icon: ShieldCheck,   bg: "bg-great-bg",   ring: "bg-great-text",   text: "text-great-text"   },
  { key: "good"    as const, label: "Good",           icon: ThumbsUp,      bg: "bg-good-bg",    ring: "bg-good-text",    text: "text-good-text"    },
  { key: "bad"     as const, label: "Red Flags",      icon: AlertTriangle, bg: "bg-bad-bg",     ring: "bg-bad-text",     text: "text-bad-text"     },
  { key: "unclear" as const, label: "Unclear",        icon: HelpCircle,    bg: "bg-unclear-bg", ring: "bg-unclear-text", text: "text-unclear-text" },
];

const ResultsSection = ({ analysis, insurerId, onReset }: ResultsSectionProps) => {
  const [viewMode, setViewMode] = useState<'v1' | 'v2'>('v2');

  return (
    <div className="animate-fade-in space-y-5">

      {/* View toggle — collapsed by default */}
      <div className="flex justify-end">
        <details className="group">
          <summary className="text-xs text-muted-foreground hover:text-foreground cursor-pointer list-none transition-colors select-none">
            {viewMode === 'v2' ? 'Switch to full breakdown view ↓' : 'Switch to impact view ↓'}
          </summary>
          <div className="mt-2 flex justify-end">
            <div className="inline-flex rounded-lg border border-border overflow-hidden text-xs font-semibold shadow-sm">
              <button
                onClick={() => setViewMode('v1')}
                className={`px-4 py-2 transition-colors ${
                  viewMode === 'v1'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:bg-muted'
                }`}
              >
                Full Breakdown
              </button>
              <button
                onClick={() => setViewMode('v2')}
                className={`px-4 py-2 transition-colors border-l border-border ${
                  viewMode === 'v2'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:bg-muted'
                }`}
              >
                Impact View
              </button>
            </div>
          </div>
        </details>
      </div>

      {viewMode === 'v2' ? (
        <V2ResultsView analysis={analysis} insurerId={insurerId} />
      ) : (
        <>
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

          {/* Detailed breakdown */}
          <div className="bg-card rounded-2xl border border-border shadow-md p-6 md:p-8">
            <h3 className="font-display text-xl text-foreground mb-5">Detailed Breakdown</h3>
            <FeatureSection type="great"   features={analysis.features.great}   defaultOpen />
            <FeatureSection type="bad"     features={analysis.features.bad}     defaultOpen />
            <FeatureSection type="good"    features={analysis.features.good} />
            <FeatureSection type="unclear" features={analysis.features.unclear} />
          </div>
        </>
      )}

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
