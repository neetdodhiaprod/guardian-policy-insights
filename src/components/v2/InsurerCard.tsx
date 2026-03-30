import { MessageSquareQuote } from 'lucide-react';
import { INSURER_DATA, InsurerMetric } from '@/data/insurerData';

const INSURER_MONO: Record<string, string> = {
  'aditya-birla':     'AB',
  'care':             'CH',
  'hdfc-ergo':        'HE',
  'icici-lombard':    'IL',
  'niva-bupa':        'NB',
  'star-health-care': 'SH',
};

interface InsurerCardProps {
  insurerId: string;
  insurerColor: string;
}

function gradeColor(grade: InsurerMetric['grade']): string {
  if (grade === 'great')  return 'text-great-text';
  if (grade === 'good')   return 'text-covered-text';
  if (grade === 'bad')    return 'text-bad-text';
  return 'text-foreground';
}

function gradeHex(grade: InsurerMetric['grade']): string {
  if (grade === 'great')  return '#15803D';
  if (grade === 'good')   return '#2563EB';
  if (grade === 'bad')    return '#DC2626';
  return '#6B7280';
}

// ── Metric cell ───────────────────────────────────────────────────────────────

interface MetricCellProps {
  label: string;
  value: string;
  what: string;
  grade: InsurerMetric['grade'];
  barPct?: number;
  borderRight?: boolean;
  borderBottom?: boolean;
}

function MetricCell({ label, value, what, grade, barPct, borderRight, borderBottom }: MetricCellProps) {
  return (
    <div className={`px-5 py-5 flex flex-col gap-2 ${borderRight ? 'border-r border-border' : ''} ${borderBottom ? 'border-b border-border' : ''}`}>
      <p className="label-editorial text-muted-foreground">{label}</p>
      <p className={`text-[1.65rem] font-tnum font-bold leading-none ${gradeColor(grade)}`}>{value}</p>
      {barPct !== undefined && (
        <div className="w-full h-1 bg-surface-sunken rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${barPct}%`, backgroundColor: gradeHex(grade) }}
          />
        </div>
      )}
      <p className="text-xs text-muted-foreground leading-relaxed">{what}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const InsurerCard = ({ insurerId, insurerColor }: InsurerCardProps) => {
  const data = INSURER_DATA[insurerId];
  if (!data) return null;

  const mono         = INSURER_MONO[insurerId] ?? data.displayName.slice(0, 2).toUpperCase();
  // CSR bar: 80–100 range scaled to 0–100% for visual differentiation
  const csrPct    = parseInt(data.csr.value) || 0;
  const csrBarPct = Math.max(0, Math.min(100, (csrPct - 80) / 20 * 100));

  // ICR bar: direct % — shows how much of your premium actually becomes claims
  const icrPct = parseInt(data.icr.value) || 0;

  const complaintsShort =
    data.complaints.value === 'Not disclosed'
      ? 'N/A'
      : data.complaints.value.split(' ')[0];

  const complaintsWhat =
    data.complaints.value === 'Not disclosed'
      ? 'Complaint data not separately published for this insurer'
      : 'Grievances per 10,000 claims — lower means fewer disputes';

  return (
    <div className="rounded-xl border border-border shadow-card overflow-hidden bg-card"
      style={{ borderTop: `3px solid ${insurerColor}` }}>

      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-sm flex-shrink-0 flex items-center justify-center text-white font-bold text-xs"
          style={{ background: insurerColor }}
        >
          {mono}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground leading-tight">{data.displayName}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Insurer Trust Check · IRDAI FY 2023–24</p>
        </div>
      </div>

      {/* 2×2 metric grid */}
      <div className="grid grid-cols-2 border-t border-border">
        <MetricCell
          label="Claims Settled"
          value={data.csr.value}
          what={`Industry avg: ~94% · ${csrPct >= 97 ? 'Top-tier' : csrPct >= 94 ? 'Above average' : 'Below average'} — % of valid claims paid`}
          grade={data.csr.grade}
          barPct={csrBarPct}
          borderRight
          borderBottom
        />
        <MetricCell
          label="Payout Ratio (ICR)"
          value={data.icr.value}
          what={`₹${icrPct} of every ₹100 in premium went to paying claims`}
          grade={data.icr.grade}
          barPct={icrPct}
          borderBottom
        />
        <MetricCell
          label="Cashless Hospitals"
          value={data.hospitals.value}
          what="Hospitals where you can get treated without paying upfront"
          grade={data.hospitals.grade}
          borderRight
        />
        <MetricCell
          label="Complaints / 10k"
          value={complaintsShort}
          what={complaintsWhat}
          grade={data.complaints.grade}
        />
      </div>

      {/* Guardian's Take */}
      <div className="px-5 py-4 border-t border-border bg-surface-sunken/30">
        <div className="flex items-center gap-1.5 mb-2">
          <MessageSquareQuote className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <p className="label-editorial text-muted-foreground">Guardian's Take</p>
        </div>
        <p className="text-sm text-foreground/80 leading-relaxed">{data.take}</p>
      </div>
    </div>
  );
};

export default InsurerCard;
