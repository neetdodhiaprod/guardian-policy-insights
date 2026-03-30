interface ShieldScoreRingProps {
  score: number;
  label: string;
  description?: string;
  size?: 'md' | 'lg';
}

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function scoreColor(score: number): string {
  if (score >= 80) return 'hsl(var(--great))';
  if (score >= 60) return 'hsl(var(--good))';
  if (score >= 40) return 'hsl(var(--unclear))';
  return 'hsl(var(--bad))';
}

const ShieldScoreRing = ({ score, label, description, size = 'md' }: ShieldScoreRingProps) => {
  const progress = Math.max(0, Math.min(100, score));
  const dashOffset = CIRCUMFERENCE * (1 - progress / 100);
  const color = scoreColor(score);
  const svgSize = size === 'lg' ? 120 : 96;
  const fontSize = size === 'lg' ? '22px' : '20px';

  return (
    <div className={`flex flex-col items-center gap-1 ${size === 'lg' ? 'max-w-[140px]' : 'max-w-[120px]'}`}>
      <svg width={svgSize} height={svgSize} viewBox="0 0 96 96" className="-rotate-90">
        {/* Track */}
        <circle
          cx="48" cy="48" r={RADIUS}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="8"
        />
        {/* Progress */}
        <circle
          cx="48" cy="48" r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        {/* Score text — counter-rotate to keep upright */}
        <text
          x="48" y="48"
          textAnchor="middle"
          dominantBaseline="central"
          className="rotate-90"
          style={{
            transform: 'rotate(90deg)',
            transformOrigin: '48px 48px',
            fill: color,
            fontSize,
            fontWeight: '700',
            fontFamily: 'var(--font-display, serif)',
          }}
        >
          {score}
        </text>
      </svg>
      <span className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">{label}</span>
      {description && (
        <p className="text-[10px] text-muted-foreground text-center leading-snug mt-0.5">
          {description}
        </p>
      )}
    </div>
  );
};

export default ShieldScoreRing;
