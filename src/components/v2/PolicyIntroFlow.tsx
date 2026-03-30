import { useState, useCallback, useRef } from 'react';
import {
  ArrowRight, ShieldCheck, CircleDollarSign, BedDouble,
  Clock, Scissors, IndianRupee,
} from 'lucide-react';
import { V2Model } from '@/lib/v2Transform';
import { CustomerInfo, PolicyAnalysis } from '@/lib/mockData';

interface Props {
  analysis: PolicyAnalysis;
  model: V2Model;
  customerInfo?: CustomerInfo | null;
  onComplete: () => void;
}

type Grade = 'great' | 'good' | 'bad' | 'unclear';

interface IntroCard {
  id: string;
  type: 'hook' | 'finding' | 'ready';
  eyebrow: string;
  Icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  headline: string;
  body: string;
  finding?: {
    grade: Grade;
    score?: number;      // numeric shield score (hook / ready only)
    heroText: string;    // large verdict — the main message
    conceptBody: string; // narrative explanation of the concept
    detail: string;      // concrete example / key fact
    action?: string;     // explicit "what to do" guidance
  };
}

// ─── grade palette ────────────────────────────────────────────────────────────

const GRADE_HEX: Record<Grade, string> = {
  great:   '#15803D',
  good:    '#2563EB',
  bad:     '#DC2626',
  unclear: '#D97706',
};

const GRADE_BG: Record<Grade, string> = {
  great:   '#F0FDF4',
  good:    '#EFF6FF',
  bad:     '#FEF2F2',
  unclear: '#FFFBEB',
};

const GRADE_BORDER: Record<Grade, string> = {
  great:   '#86EFAC',
  good:    '#93C5FD',
  bad:     '#FECACA',
  unclear: '#FCD34D',
};

const GRADE_LABEL: Record<Grade, string> = {
  great:   'Good for you',
  good:    'Covered',
  bad:     'Risk',
  unclear: 'Check this',
};

// ─── progress dot helpers ─────────────────────────────────────────────────────

function dotBg(card: IntroCard, i: number, current: number): string {
  if (i === current) return '#0B63CE';
  if (i < current)  return '#CBD5E1';
  if (card.type === 'finding' && card.finding) return GRADE_BG[card.finding.grade];
  return '#E2E8F0';
}

function dotOutline(card: IntroCard, i: number, current: number): string {
  if (i === current) return '#0B63CE';
  if (i < current)  return '#94A3B8';
  if (card.type === 'finding' && card.finding) return GRADE_BORDER[card.finding.grade];
  return '#CBD5E1';
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatSI(val: string | null): string | null {
  if (!val) return null;
  const n = parseInt(val);
  if (isNaN(n)) return null;
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)} Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(0)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function extractPct(text: string): string | null {
  const m = text.match(/(\d+)%/);
  return m ? `${m[1]}%` : null;
}

function stagger(delayMs: number): React.CSSProperties {
  return { animation: `enterUp 0.3s ease-out ${delayMs}ms both` };
}

// ─── card factory ─────────────────────────────────────────────────────────────

function buildCards(
  model: V2Model,
  analysis: PolicyAnalysis,
  ci: CustomerInfo | null,
): IntroCard[] {
  const cards: IntroCard[] = [];
  const crit = (name: string) => model.critical.find(f => f.displayName === name);
  const bad = model.badCriticalFeatures.length;

  const scoreLabel =
    model.shieldScore >= 80 ? 'Well covered'
    : model.shieldScore >= 60 ? 'Decent cover'
    : 'Needs review';

  const scoreGrade: Grade =
    model.shieldScore >= 80 ? 'great'
    : model.shieldScore >= 60 ? 'good'
    : 'bad';

  // ── Hook ───────────────────────────────────────────────────────────────────
  cards.push({
    id: 'hook',
    type: 'hook',
    eyebrow: analysis.insurer ?? 'Your Policy',
    Icon: ShieldCheck,
    iconColor: GRADE_HEX[scoreGrade],
    headline: bad > 0
      ? `${bad > 1 ? 'A few things' : 'One thing'} to know before you claim.`
      : 'Your policy is in good shape.',
    body: bad > 0
      ? `We found ${bad} clause${bad > 1 ? 's' : ''} in your policy that can reduce what you actually receive at claim time. Most policyholders never read these — walk through them now.`
      : 'No critical gaps detected. Most policyholders never know their policy this well. Walk through the key terms so you do.',
    finding: {
      grade: scoreGrade,
      score: model.shieldScore,
      heroText: scoreLabel,
      conceptBody: '',
      detail: `${analysis.insurer} · ${analysis.policyName ?? 'Your Policy'}`,
    },
  });

  // ── Co-pay ─────────────────────────────────────────────────────────────────
  const copay = crit('Co-pay');
  if (copay) {
    const pct = extractPct(copay.impactStatement);
    const isBad = copay.grade === 'bad';
    const findingNum = cards.length;
    const totalBad = Math.min(bad + 1, 3);
    cards.push({
      id: 'copay',
      type: 'finding',
      eyebrow: `Finding ${findingNum} of ${totalBad}`,
      Icon: CircleDollarSign,
      iconColor: isBad ? '#DC2626' : '#15803D',
      headline: 'Co-pay',
      body: '',
      finding: isBad ? {
        grade: 'bad',
        heroText: pct ? `${pct} co-pay on every claim` : 'Co-pay clause active',
        conceptBody: `Most people assume their insurer pays 100% of a valid claim. Co-pay changes that permanently — you've agreed to split every single bill, regardless of the illness, the cost, or how many times you've claimed before.`,
        detail: pct
          ? `On a ₹2L hospital bill, you pay ₹${Math.round(200000 * parseInt(pct) / 100 / 1000)}K yourself. The insurer pays the rest.`
          : copay.impactStatement,
        action: 'At renewal, ask your insurer if a co-pay waiver rider is available. When comparing new policies, look for "zero co-pay" options.',
      } : {
        grade: 'great',
        heroText: 'No co-pay clause',
        conceptBody: `Many policies quietly include a co-pay clause — a permanent requirement to split every bill with your insurer. Your policy doesn't have one.`,
        detail: 'Your insurer pays 100% of every valid claim. Nothing extra comes out of your pocket.',
      },
    });
  }

  // ── Room Rent ──────────────────────────────────────────────────────────────
  const roomRent = crit('Room Rent');
  if (roomRent) {
    const isBad = roomRent.grade === 'bad';
    const findingNum = cards.length;
    const totalBad = Math.min(bad + 1, 3);
    cards.push({
      id: 'room-rent',
      type: 'finding',
      eyebrow: `Finding ${findingNum} of ${totalBad}`,
      Icon: BedDouble,
      iconColor: isBad ? '#C2410C' : '#15803D',
      headline: 'Room Rent Limit',
      body: '',
      finding: isBad ? {
        grade: 'bad',
        heroText: 'Room rent cap applies',
        conceptBody: `The trap most people miss: room rent limits don't just cap your room cost. They trigger a proportionate cut across your entire bill — surgeon fees, anaesthesia, medicines, diagnostics — everything gets reduced if you pick the wrong room.`,
        detail: 'Before admission, ask the hospital: "Which room fits a policy with a room rent cap?" If it\'s an emergency, call your insurer the next day to confirm.',
      } : {
        grade: 'great',
        heroText: 'No room rent cap',
        conceptBody: `Room rent limits create a ripple effect across your entire bill — go over the limit and your insurer cuts surgeon fees, medicines, and tests proportionally. Your policy has no such limit.`,
        detail: 'Choose any room. Your full sum insured applies — no proportionate cuts to the rest of your bill.',
      },
    });
  }

  // ── Third finding: PED / sub-limits / sum insured ─────────────────────────
  const ped = crit('PED Waiting Period');
  const sublimits = crit('Disease Sub-limits');
  const si = ci?.sumInsured ? formatSI(ci.sumInsured) : null;

  if (ped && ped.grade === 'bad' && bad > 1) {
    const dur = ped.impactStatement.match(/(\d+)\s*(month|year)/i);
    const duration = dur ? dur[0] : 'a waiting period';
    const findingNum = cards.length;
    cards.push({
      id: 'ped',
      type: 'finding',
      eyebrow: `Finding ${findingNum} of ${Math.min(bad + 1, 3)}`,
      Icon: Clock,
      iconColor: '#7C3AED',
      headline: 'Pre-existing Disease Waiting Period',
      body: '',
      finding: {
        grade: 'bad',
        heroText: `${duration} before PED claims are covered`,
        conceptBody: `Any condition you had in the 4 years before buying this policy counts as a pre-existing disease. File a claim for it before the waiting period ends and it will be rejected — regardless of the treatment cost.`,
        detail: 'Calculate your waiting period end date and mark it. A claim filed one day early is a claim denied.',
        action: "Contact your insurer to confirm the exact PED expiry date — it's usually the policy anniversary after the waiting period ends.",
      },
    });
  } else if (sublimits && sublimits.grade === 'bad' && bad > 1) {
    const findingNum = cards.length;
    cards.push({
      id: 'sublimits',
      type: 'finding',
      eyebrow: `Finding ${findingNum} of ${Math.min(bad + 1, 3)}`,
      Icon: Scissors,
      iconColor: '#BE185D',
      headline: 'Disease Sub-limits',
      body: '',
      finding: {
        grade: 'bad',
        heroText: 'Sub-limits apply to certain treatments',
        conceptBody: `Your sum insured is ₹25L. Your policy says cataract surgery is capped at ₹40,000. That ₹40K limit applies — not ₹25L. Sub-limits override your sum insured for specific procedures.`,
        detail: 'Before any planned surgery, ask your insurer: "Is there a sub-limit for this procedure?"',
        action: 'Request the full sub-limits schedule from your insurer. Keep it on file before scheduling any planned procedure.',
      },
    });
  } else if (si && ci?.sumInsured) {
    const siNum = parseInt(ci.sumInsured);
    const members = ci.members?.length || 1;
    const perPerson = siNum / members;
    const adequate = perPerson >= 700000;
    const findingNum = cards.length;
    cards.push({
      id: 'sum-insured',
      type: 'finding',
      eyebrow: copay && roomRent ? `Finding ${findingNum} of 3` : 'Your coverage',
      Icon: IndianRupee,
      iconColor: adequate ? '#2563EB' : '#DC2626',
      headline: 'Sum Insured',
      body: '',
      finding: {
        grade: adequate ? 'good' : 'bad',
        heroText: `${si}${members > 1 ? ` shared across ${members} members` : ''}`,
        conceptBody: adequate
          ? `Sum insured is the pool you draw from for the year. For family floater plans, the entire family shares it — one hospitalisation can consume a large portion.`
          : `A single ICU admission or major surgery can cost ₹5–20L at a private hospital. Your current cover leaves you exposed to out-of-pocket costs if a serious illness strikes.`,
        detail: adequate
          ? 'Adequate for most serious hospitalisations in a private hospital.'
          : 'A serious surgery or ICU stay at a private hospital can cost ₹5–20L.',
        action: adequate
          ? undefined
          : 'Look into super top-up plans — they extend your cover significantly for a fraction of a base policy\'s premium.',
      },
    });
  }

  // ── Ready — personalized summary ──────────────────────────────────────────
  const badFindings = cards
    .filter(c => c.type === 'finding' && c.finding?.grade === 'bad')
    .map(c => c.headline.toLowerCase());

  let summaryBody: string;
  if (bad === 0) {
    summaryBody = 'No co-pay. No room rent cap. No critical gaps. Most policyholders can\'t say that. You can.';
  } else if (badFindings.length === 1) {
    summaryBody = `You now know your policy has a ${badFindings[0]} clause that will affect your claims. Most policyholders only discover this in the hospital.`;
  } else if (badFindings.length >= 2) {
    const last = badFindings[badFindings.length - 1];
    const rest = badFindings.slice(0, -1).join(', ');
    summaryBody = `You now know your policy has ${rest} and ${last} clauses that affect your claims. Most policyholders only discover these in the hospital. You won't be one of them.`;
  } else {
    summaryBody = 'The full analysis shows every clause with exact policy wording. You know the risks — now see the details.';
  }

  cards.push({
    id: 'ready',
    type: 'ready',
    eyebrow: "You're ready",
    Icon: ShieldCheck,
    iconColor: GRADE_HEX[scoreGrade],
    headline: 'Now you know what to look for.',
    body: summaryBody,
    finding: {
      grade: scoreGrade,
      score: model.shieldScore,
      heroText: scoreLabel,
      conceptBody: '',
      detail: `${analysis.insurer} · ${analysis.policyName ?? 'Your Policy'}`,
    },
  });

  return cards;
}

// ─── Component ────────────────────────────────────────────────────────────────

const PolicyIntroFlow = ({ analysis, model, customerInfo, onComplete }: Props) => {
  const ci = customerInfo ?? null;
  const [current, setCurrent] = useState(0);
  const [exiting, setExiting] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const cards = buildCards(model, analysis, ci);
  const card  = cards[current];
  const total = cards.length;
  const isLast = current === total - 1;

  const advance = useCallback(() => {
    if (exiting) return;
    if (isLast) { onComplete(); return; }
    setExiting(true);
    setTimeout(() => {
      setCurrent(c => c + 1);
      setExiting(false);
    }, 180);
  }, [exiting, isLast, onComplete]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    if (dx > 50) advance();
    touchStartX.current = null;
  };

  const { Icon } = card;
  const f = card.finding;
  const gradeHex    = f ? GRADE_HEX[f.grade]   : '#0B63CE';
  const gradeBg     = f ? GRADE_BG[f.grade]     : '#EBF3FD';
  const gradeBorder = f ? GRADE_BORDER[f.grade] : '#93C5FD';

  const cardAnimation = exiting
    ? 'slideOutLeft 0.18s ease-in both'
    : 'slideInRight 0.28s ease-out both';

  return (
    <div className="space-y-4">
      {/* Progress + skip */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5 items-center">
          {cards.map((c, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === current ? '1.75rem' : '0.5rem',
                backgroundColor: dotBg(c, i, current),
                border: `1px solid ${dotOutline(c, i, current)}`,
                opacity: i > current && c.type === 'finding' ? 0.65 : 1,
              }}
            />
          ))}
        </div>
        <button
          onClick={onComplete}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip →
        </button>
      </div>

      {/* Card */}
      <div
        key={card.id}
        className="rounded-xl border border-border bg-card shadow-card overflow-hidden"
        style={{ animation: cardAnimation }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >

        {/* ── Hook / Ready ─────────────────────────────────────────────────── */}
        {(card.type === 'hook' || card.type === 'ready') && f && (
          <>
            {/* Top panel — grade-tinted with score hero */}
            <div className="px-6 pt-6 pb-6" style={{ background: gradeBg }}>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.14em] mb-5"
                style={{ ...stagger(0), color: gradeHex + 'cc' }}
              >
                {card.eyebrow}
              </p>

              <div style={stagger(40)}>
                {f.score !== undefined ? (
                  <div className="flex items-baseline gap-1.5 mb-1">
                    <span
                      className="font-display font-bold leading-none"
                      style={{ fontSize: '4.5rem', color: gradeHex }}
                    >
                      {f.score}
                    </span>
                    <span className="text-xl font-semibold leading-none" style={{ color: gradeHex + '70' }}>
                      /100
                    </span>
                  </div>
                ) : (
                  <p className="font-display text-3xl leading-tight" style={{ color: gradeHex }}>
                    {f.heroText}
                  </p>
                )}
                <p className="text-sm font-semibold mt-1" style={{ color: gradeHex }}>
                  {f.score !== undefined ? f.heroText : ''}
                </p>
              </div>
            </div>

            {/* Bottom panel — white */}
            <div className="border-t px-6 pt-5 pb-2" style={{ borderColor: gradeBorder }}>
              <div style={stagger(80)}>
                <h2 className="font-display text-xl text-foreground leading-snug">{card.headline}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed mt-2">{card.body}</p>
              </div>
              {f.detail && (
                <p
                  className="text-[11px] text-muted-foreground mt-4 pt-3 border-t border-border"
                  style={stagger(130)}
                >
                  {f.detail}
                </p>
              )}
            </div>
          </>
        )}

        {/* ── Finding ──────────────────────────────────────────────────────── */}
        {card.type === 'finding' && f && (
          <>
            {/* Top panel — grade-tinted with verdict */}
            <div className="px-6 pt-6 pb-6" style={{ background: gradeBg }}>
              {/* Eyebrow + grade badge */}
              <div className="flex items-center justify-between mb-5" style={stagger(0)}>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: gradeHex + 'aa' }}
                >
                  {card.eyebrow}
                </p>
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full"
                  style={{ background: gradeHex + '18', color: gradeHex, border: `1px solid ${gradeBorder}` }}
                >
                  {GRADE_LABEL[f.grade]}
                </span>
              </div>

              {/* Icon + topic */}
              <div className="flex items-center gap-3 mb-5" style={stagger(40)}>
                <div
                  className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center"
                  style={{ background: gradeHex + '18' }}
                >
                  <Icon className="w-5 h-5" style={{ color: card.iconColor }} />
                </div>
                <p className="text-xs font-bold uppercase tracking-[0.1em]" style={{ color: gradeHex + 'aa' }}>
                  {card.headline}
                </p>
              </div>

              {/* Hero verdict */}
              <p
                className="font-display text-2xl leading-snug"
                style={{ ...stagger(80), color: gradeHex }}
              >
                {f.heroText}
              </p>
            </div>

            {/* Bottom panel — white */}
            <div className="border-t px-6 pt-5 pb-2" style={{ borderColor: gradeBorder }}>
              {/* Concept explanation */}
              <p className="text-sm text-muted-foreground leading-relaxed mb-4" style={stagger(120)}>
                {f.conceptBody}
              </p>

              {/* Concrete example / key fact */}
              <div
                className="rounded-lg px-4 py-3 border text-xs text-foreground/80 leading-relaxed mb-3"
                style={{ ...stagger(160), background: gradeBg, borderColor: gradeBorder }}
              >
                {f.detail}
              </div>

              {/* Action — "what to do" with left accent border */}
              {f.action && (
                <div
                  className="pl-3 py-1 mb-1 text-xs text-muted-foreground leading-relaxed"
                  style={{ ...stagger(200), borderLeft: `2px solid ${gradeHex}` }}
                >
                  <span className="font-semibold text-foreground">What to do: </span>
                  {f.action}
                </div>
              )}
            </div>
          </>
        )}

        {/* CTA */}
        <div
          className="px-6 pb-6 pt-4"
          style={stagger(card.type === 'finding' ? (f?.action ? 240 : 200) : 160)}
        >
          <button
            onClick={advance}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            {isLast ? 'See my full analysis' : 'Got it, continue'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PolicyIntroFlow;
