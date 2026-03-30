import { useState } from "react";
import { ChevronDown, ChevronRight, ShieldCheck, ThumbsUp, AlertTriangle, HelpCircle, Quote } from "lucide-react";
import { PolicyFeature } from "@/lib/mockData";

type FeatureType = "great" | "good" | "bad" | "unclear";

interface FeatureSectionProps {
  type: FeatureType;
  features: PolicyFeature[];
  defaultOpen?: boolean;
}

const typeConfig = {
  great: {
    title: "Best-in-class",
    icon: ShieldCheck,
    bgClass: "bg-great-bg",
    textClass: "text-great-text",
    contentBg: "bg-card",
    borderClass: "border-great-border",
    quoteBg: "bg-surface-sunken",
    quoteBorder: "border-border-subtle",
    headerBorder: "border-great-border",
  },
  good: {
    title: "Good Features",
    icon: ThumbsUp,
    bgClass: "bg-good-bg",
    textClass: "text-good-text",
    contentBg: "bg-card",
    borderClass: "border-good-border",
    quoteBg: "bg-surface-sunken",
    quoteBorder: "border-border-subtle",
    headerBorder: "border-good-border",
  },
  bad: {
    title: "Red Flags",
    icon: AlertTriangle,
    bgClass: "bg-bad-bg",
    textClass: "text-bad-text",
    contentBg: "bg-card",
    borderClass: "border-bad-border",
    quoteBg: "bg-surface-sunken",
    quoteBorder: "border-border-subtle",
    headerBorder: "border-bad-border",
  },
  unclear: {
    title: "Needs Clarification",
    icon: HelpCircle,
    bgClass: "bg-unclear-bg",
    textClass: "text-unclear-text",
    contentBg: "bg-card",
    borderClass: "border-unclear-border",
    quoteBg: "bg-surface-sunken",
    quoteBorder: "border-border-subtle",
    headerBorder: "border-unclear-border",
  },
};

function FeatureItem({ feature, config }: { feature: PolicyFeature; config: typeof typeConfig.great }) {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const hasQuote = !!(feature.quote || feature.reference);

  return (
    <div className="px-5 py-4">
      {/* Feature name */}
      <p className="font-semibold text-sm text-foreground mb-1.5">{feature.name}</p>

      {/* What it means for you */}
      {feature.explanation && (
        <p className="text-sm text-muted-foreground leading-relaxed mb-2.5">{feature.explanation}</p>
      )}

      {/* Expandable policy quote */}
      {hasQuote && (
        <div>
          <button
            onClick={() => setQuoteOpen((o) => !o)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {quoteOpen ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            Policy states
          </button>

          {quoteOpen && (
            <div className={`mt-2 rounded-sm border ${config.quoteBorder} ${config.quoteBg} px-4 py-3`}>
              <div className="flex gap-2.5">
                <Quote className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  {feature.quote && (
                    <p className="text-sm text-foreground italic leading-relaxed">"{feature.quote}"</p>
                  )}
                  {feature.reference && (
                    <p className="text-xs text-muted-foreground mt-1.5">{feature.reference}</p>
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

const FeatureSection = ({ type, features, defaultOpen = false }: FeatureSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const config = typeConfig[type];
  const Icon = config.icon;

  if (!features || features.length === 0) return null;

  return (
    <div className={`border ${config.headerBorder} rounded-lg overflow-hidden mb-3`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full ${config.bgClass} px-5 py-3.5 flex items-center justify-between transition-all duration-200 border-b ${config.headerBorder}`}
      >
        <div className="flex items-center gap-2.5">
          <Icon className={`w-4 h-4 ${config.textClass}`} />
          <span className={`font-semibold text-sm ${config.textClass}`}>{config.title}</span>
          <span className={`${config.textClass} opacity-60 text-xs`}>({features.length})</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 ${config.textClass} transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className={`${config.contentBg} divide-y ${config.borderClass}`}>
          {features.map((feature, index) => (
            <FeatureItem key={index} feature={feature} config={config} />
          ))}
        </div>
      )}
    </div>
  );
};

export default FeatureSection;
