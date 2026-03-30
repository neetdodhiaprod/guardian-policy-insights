import { ShieldCheck, ThumbsUp, AlertTriangle, HelpCircle } from "lucide-react";

interface SummaryCardProps {
  summary: {
    great: number;
    good: number;
    bad: number;
    unclear: number;
  };
  policyName: string;
  insurer: string;
}

const SummaryCard = ({ summary, policyName, insurer }: SummaryCardProps) => {
  return (
    <div className="bg-card rounded-2xl shadow-card p-6 md:p-8 mb-6">
      <div className="mb-6">
        <h2 className="font-display text-2xl text-foreground mb-1">
          {policyName}
        </h2>
        <p className="font-body text-muted-foreground">{insurer}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-great-bg rounded-lg p-4 text-center border border-great-border">
          <div className="w-10 h-10 bg-card rounded-sm flex items-center justify-center mx-auto mb-2 border border-great-border">
            <ShieldCheck className="w-5 h-5 text-great-text" />
          </div>
          <p className="font-display text-2xl text-great-text">{summary.great}</p>
          <p className="font-body text-sm text-muted-foreground">Great</p>
        </div>

        <div className="bg-good-bg rounded-lg p-4 text-center border border-good-border">
          <div className="w-10 h-10 bg-card rounded-sm flex items-center justify-center mx-auto mb-2 border border-good-border">
            <ThumbsUp className="w-5 h-5 text-good-text" />
          </div>
          <p className="font-display text-2xl text-good-text">{summary.good}</p>
          <p className="font-body text-sm text-muted-foreground">Good</p>
        </div>

        <div className="bg-bad-bg rounded-lg p-4 text-center border border-bad-border">
          <div className="w-10 h-10 bg-card rounded-sm flex items-center justify-center mx-auto mb-2 border border-bad-border">
            <AlertTriangle className="w-5 h-5 text-bad-text" />
          </div>
          <p className="font-display text-2xl text-bad-text">{summary.bad}</p>
          <p className="font-body text-sm text-muted-foreground">Red Flags</p>
        </div>

        <div className="bg-unclear-bg rounded-lg p-4 text-center border border-unclear-border">
          <div className="w-10 h-10 bg-card rounded-sm flex items-center justify-center mx-auto mb-2 border border-unclear-border">
            <HelpCircle className="w-5 h-5 text-unclear-text" />
          </div>
          <p className="font-display text-2xl text-unclear-text">{summary.unclear}</p>
          <p className="font-body text-sm text-muted-foreground">Unclear</p>
        </div>
      </div>
    </div>
  );
};

export default SummaryCard;
