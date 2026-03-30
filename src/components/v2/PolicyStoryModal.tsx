import { useState, useEffect, useCallback } from 'react';
import {
  X, ArrowRight, CircleDollarSign, BedDouble, Clock, Scissors,
  RefreshCw, TrendingUp, IndianRupee, Building2, ShieldCheck,
  AlertTriangle, CheckCircle2, HelpCircle, Stethoscope, CalendarCheck,
} from 'lucide-react';
import { V2Model } from '@/lib/v2Transform';
import { CustomerInfo, PolicyAnalysis } from '@/lib/mockData';
import { INSURER_DATA } from '@/data/insurerData';

interface Props {
  analysis: PolicyAnalysis;
  model: V2Model;
  insurerId: string;
  customerInfo?: CustomerInfo | null;
  onClose: () => void;
}

type Grade = 'great' | 'good' | 'bad' | 'unclear';

interface StoryCard {
  id: string;
  chapter: string;
  concept: string;           // plain-English concept name
  Icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  definition: string;        // universal: "What is this?"
  status: {
    grade: Grade;
    value: string;           // YOUR policy: "No co-pay" / "20% co-pay" / "₹25 L"
    impact: string;          // so what: 1 sentence about their money
  };
  tip?: string;              // optional claim-time tip
  isFinal?: boolean;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function gradeStyle(grade: Grade) {
  if (grade === 'great') return { bg: '#dcfce7', border: '#86efac', text: '#15803d', icon: CheckCircle2 };
  if (grade === 'good')  return { bg: '#dbeafe', border: '#93c5fd', text: '#1d4ed8', icon: CheckCircle2 };
  if (grade === 'bad')   return { bg: '#fee2e2', border: '#fca5a5', text: '#b91c1c', icon: AlertTriangle };
  return                        { bg: '#fef9c3', border: '#fde047', text: '#a16207', icon: HelpCircle };
}

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

// ─── card factory ─────────────────────────────────────────────────────────────

function buildCards(
  model: V2Model,
  analysis: PolicyAnalysis,
  ci: CustomerInfo | null,
  insurerId: string,
): StoryCard[] {
  const cards: StoryCard[] = [];
  const crit = (name: string) => model.critical.find(f => f.displayName === name);
  const insurer = INSURER_DATA[insurerId];

  // ── Intro ────────────────────────────────────────────────────────────────────
  const scoreLabel =
    model.shieldScore >= 80 ? 'Well covered'
    : model.shieldScore >= 60 ? 'Decent cover'
    : 'Needs attention';
  const scoreGrade: Grade =
    model.shieldScore >= 80 ? 'great'
    : model.shieldScore >= 60 ? 'good'
    : 'bad';

  cards.push({
    id: 'intro',
    chapter: 'Your Policy',
    concept: analysis.policyName ?? 'Your Health Policy',
    Icon: ShieldCheck,
    iconBg: '#e0f2fe',
    definition: 'We\'ll walk through the key clauses of your policy — in plain English. No jargon.',
    status: {
      grade: scoreGrade,
      value: `${model.shieldScore}/100 — ${scoreLabel}`,
      impact: model.badCriticalFeatures.length > 0
        ? `${model.badCriticalFeatures.length} clause${model.badCriticalFeatures.length > 1 ? 's' : ''} that could reduce your payout. Let's understand them.`
        : 'No critical gaps found. Let\'s confirm the details.',
    },
  });

  // ── Co-pay ───────────────────────────────────────────────────────────────────
  const copay = crit('Co-pay');
  if (copay) {
    const pct = extractPct(copay.impactStatement);
    if (copay.grade === 'bad') {
      cards.push({
        id: 'copay-bad',
        chapter: 'What you pay',
        concept: 'Co-pay',
        Icon: CircleDollarSign,
        iconBg: '#fee2e2',
        definition: 'A co-pay clause means you agree to pay a fixed percentage of every hospital bill yourself — on top of what your insurer pays. It applies to every single claim.',
        status: {
          grade: 'bad',
          value: pct ? `${pct} co-pay on every claim` : 'Co-pay clause active',
          impact: pct
            ? `On a ₹2,00,000 bill — you pay ₹${(2000000 * parseInt(pct) / 100 / 1000).toFixed(0)}K. Your insurer pays the rest.`
            : 'A portion of every claim comes from your own pocket, regardless of your sum insured.',
        },
        tip: 'At renewal, ask your insurer if a co-pay waiver rider is available.',
      });
    } else {
      cards.push({
        id: 'copay-good',
        chapter: 'What you pay',
        concept: 'Co-pay',
        Icon: CircleDollarSign,
        iconBg: '#dcfce7',
        definition: 'A co-pay clause means you share the cost of every claim with the insurer. Many policies have 10–20% co-pay. Yours doesn\'t.',
        status: {
          grade: 'great',
          value: 'No co-pay clause',
          impact: 'Your insurer pays 100% of every admissible claim. Nothing extra comes from your pocket.',
        },
      });
    }
  }

  // ── Room Rent ─────────────────────────────────────────────────────────────────
  const roomRent = crit('Room Rent');
  if (roomRent) {
    if (roomRent.grade === 'bad') {
      cards.push({
        id: 'room-bad',
        chapter: 'What you pay',
        concept: 'Room Rent Limit',
        Icon: BedDouble,
        iconBg: '#ffedd5',
        definition: 'If your policy has a room rent limit, choosing a room above that limit triggers proportionate deductions — not just on the room cost, but across your entire hospital bill.',
        status: {
          grade: 'bad',
          value: 'Room rent cap applies',
          impact: 'Surgeon fees, medicines, diagnostics — all reduced if you book the wrong room. This catches most people off-guard.',
        },
        tip: 'Ask the hospital for a room within your policy\'s limit before getting admitted.',
      });
    } else {
      cards.push({
        id: 'room-good',
        chapter: 'What you pay',
        concept: 'Room Rent',
        Icon: BedDouble,
        iconBg: '#dcfce7',
        definition: 'Room rent limits are one of the most common reasons claims are partially paid. They cause the insurer to pro-rate your entire bill if you exceed the cap.',
        status: {
          grade: 'great',
          value: 'No room rent cap',
          impact: 'You can book any room. Your full sum insured applies — no proportionate cuts to the rest of your bill.',
        },
      });
    }
  }

  // ── PED Waiting Period ────────────────────────────────────────────────────────
  const ped = crit('PED Waiting Period');
  if (ped) {
    if (ped.grade === 'bad') {
      const dur = ped.impactStatement.match(/(\d+)\s*(month|year)/i);
      const duration = dur ? dur[0] : 'long waiting period';
      cards.push({
        id: 'ped-bad',
        chapter: 'What\'s covered',
        concept: 'Pre-existing Disease Waiting Period',
        Icon: Clock,
        iconBg: '#ede9fe',
        definition: 'A pre-existing disease (PED) is any condition you had in the 48 months before buying the policy. Most policies exclude these until a waiting period passes.',
        status: {
          grade: 'bad',
          value: `${duration} before PED claims are covered`,
          impact: 'Filing a claim for a pre-existing condition before the waiting period ends will be rejected — regardless of your premium payments.',
        },
        tip: 'Note the exact date your waiting period ends. Keep a calendar reminder.',
      });
    } else {
      cards.push({
        id: 'ped-good',
        chapter: 'What\'s covered',
        concept: 'Pre-existing Disease Waiting Period',
        Icon: Clock,
        iconBg: '#dcfce7',
        definition: 'Many policies make you wait 3–4 years before covering pre-existing conditions. A shorter waiting period means you\'re protected sooner.',
        status: {
          grade: 'great',
          value: 'Short PED waiting period',
          impact: 'Your pre-existing conditions become claimable earlier than most policies allow.',
        },
      });
    }
  }

  // ── Disease Sub-limits ────────────────────────────────────────────────────────
  const sublimits = crit('Disease Sub-limits');
  if (sublimits && sublimits.grade === 'bad') {
    cards.push({
      id: 'sublimits-bad',
      chapter: 'What\'s covered',
      concept: 'Disease Sub-limits',
      Icon: Scissors,
      iconBg: '#fce7f3',
      definition: 'Sub-limits are fixed upper caps on specific procedures — like cataract surgery, joint replacement, or hernia repair. Even if your sum insured is ₹25L, a sub-limited procedure may only be covered up to ₹30,000.',
      status: {
        grade: 'bad',
        value: 'Sub-limits apply to certain procedures',
        impact: 'Call your insurer and ask for the complete list of capped treatments before scheduling any planned surgery.',
      },
    });
  }

  // ── Best important-tier feature ────────────────────────────────────────────────
  const bestFeature =
    model.important.find(f => f.grade === 'great') ??
    model.important.find(f => f.grade === 'good');

  if (bestFeature) {
    const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
      'Restoration / Refill':         RefreshCw,
      'No-Claim Bonus':               TrendingUp,
      'Post-hospitalisation Cover':   CalendarCheck,
      'Pre-hospitalisation Cover':    CalendarCheck,
      'Day Care Procedures':          Stethoscope,
    };
    const FeatureIcon = iconMap[bestFeature.displayName] ?? CheckCircle2;

    cards.push({
      id: `strength-${bestFeature.displayName}`,
      chapter: 'Good news',
      concept: bestFeature.displayName,
      Icon: FeatureIcon,
      iconBg: '#dcfce7',
      definition: `${bestFeature.displayName} is a benefit that works in your favour — most basic policies don't include it at a meaningful level.`,
      status: {
        grade: bestFeature.grade as Grade,
        value: bestFeature.grade === 'great' ? 'Excellent' : 'Good',
        impact: bestFeature.impactStatement,
      },
    });
  }

  // ── Worst important-tier feature (if bad) ─────────────────────────────────────
  const worstFeature = model.badImportantFeatures[0];
  if (worstFeature) {
    cards.push({
      id: `concern-${worstFeature.displayName}`,
      chapter: 'Watch out for this',
      concept: worstFeature.displayName,
      Icon: AlertTriangle,
      iconBg: '#fff7ed',
      definition: `${worstFeature.displayName} is a benefit that could affect your claims or coverage in certain situations.`,
      status: {
        grade: 'bad',
        value: 'Needs attention',
        impact: worstFeature.impactStatement,
      },
      tip: worstFeature.actionRecommendation,
    });
  }

  // ── Sum Insured ───────────────────────────────────────────────────────────────
  const si = ci?.sumInsured ? formatSI(ci.sumInsured) : null;
  if (si && ci?.sumInsured) {
    const siNum = parseInt(ci.sumInsured);
    const members = ci.members?.length || 1;
    const perPerson = siNum / members;
    const adequate = perPerson >= 700000;

    cards.push({
      id: 'cover',
      chapter: 'Your coverage',
      concept: 'Sum Insured',
      Icon: IndianRupee,
      iconBg: adequate ? '#dbeafe' : '#fee2e2',
      definition: 'Sum insured is the maximum your insurer will pay in a policy year. For family floater plans, this is shared across all members — one large claim can deplete it for everyone.',
      status: {
        grade: adequate ? 'good' : 'bad',
        value: `${si}${members > 1 ? ` shared across ${members} members` : ''}`,
        impact: adequate
          ? 'Good coverage for your family size. Enough buffer for most serious hospitalisations in private hospitals.'
          : 'A single serious illness or surgery at a private hospital can cost ₹5–20L. Consider adding a super top-up.',
      },
    });
  }

  // ── Insurer ───────────────────────────────────────────────────────────────────
  if (insurer) {
    const csrNum = parseInt(insurer.csr.value) || 0;
    const good = csrNum >= 97;
    cards.push({
      id: 'insurer',
      chapter: 'Your insurer',
      concept: 'Claim Settlement',
      Icon: Building2,
      iconBg: good ? '#dbeafe' : '#fff7ed',
      definition: 'Claim Settlement Ratio (CSR) tells you how many valid claims an insurer actually paid out of 100 filed. A higher number means fewer rejections — and less friction when you need money most.',
      status: {
        grade: good ? 'great' : 'good',
        value: `${insurer.csr.value} claims settled — ${insurer.displayName}`,
        impact: good
          ? 'Top-tier. Industry average is ~94%. You\'re with one of the better-paying insurers.'
          : 'Solid, but a step below top-tier. Keep all documents and follow up quickly on delays.',
      },
    });
  }

  // ── Verdict ───────────────────────────────────────────────────────────────────
  const badCount = model.badCriticalFeatures.length;
  cards.push({
    id: 'verdict',
    chapter: 'You\'re all caught up',
    concept: 'What you know now',
    Icon: ShieldCheck,
    iconBg: '#e0f2fe',
    definition: 'You\'ve just learned the key clauses that determine how much money you get back when hospitalised. Most policyholders never know this until claim time.',
    status: {
      grade: badCount === 0 ? 'great' : badCount === 1 ? 'good' : 'bad',
      value: badCount === 0
        ? 'No critical gaps — your policy is solid'
        : badCount === 1
        ? 'One clause to watch at claim time'
        : `${badCount} critical clauses working against you`,
      impact: 'Go back to the full analysis to see the detailed breakdown with policy wording.',
    },
    isFinal: true,
  });

  return cards;
}

// ─── Card component ───────────────────────────────────────────────────────────

function Card({ card, onNext, isLast }: { card: StoryCard; onNext: () => void; isLast: boolean }) {
  const s = gradeStyle(card.status.grade);
  const StatusIcon = s.icon;
  const { Icon } = card;

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col gap-5">
      {/* Chapter label */}
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45 text-center">
        {card.chapter}
      </p>

      {/* White card */}
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Icon + concept name */}
        <div className="px-6 pt-6 pb-5 flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center"
            style={{ background: card.iconBg }}
          >
            <Icon className="w-6 h-6" style={{ color: s.text }} />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h2 className="font-display text-xl text-slate-900 leading-tight">{card.concept}</h2>
            <p className="text-sm text-slate-500 leading-relaxed mt-1">{card.definition}</p>
          </div>
        </div>

        {/* Status box — YOUR policy */}
        <div
          className="mx-4 mb-4 rounded-xl px-4 py-3.5 border"
          style={{ background: s.bg, borderColor: s.border }}
        >
          <div className="flex items-start gap-2.5">
            <StatusIcon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: s.text }} />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] mb-1" style={{ color: s.text }}>
                Your policy
              </p>
              <p className="text-sm font-semibold text-slate-800 leading-snug">{card.status.value}</p>
              <p className="text-xs text-slate-600 leading-relaxed mt-1">{card.status.impact}</p>
            </div>
          </div>
        </div>

        {/* Tip */}
        {card.tip && (
          <div className="mx-4 mb-4 bg-slate-50 rounded-lg px-4 py-3 border border-slate-100">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 mb-1">At claim time</p>
            <p className="text-xs text-slate-600 leading-relaxed">{card.tip}</p>
          </div>
        )}

        {/* Next button */}
        <div className="px-4 pb-5">
          <button
            onClick={onNext}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90"
            style={{ background: s.text }}
          >
            {isLast ? 'Back to full analysis' : 'Got it'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

const CARD_BGS: Record<string, string> = {
  'intro':          '#1e3a5f',
  'copay-bad':      '#450a0a',
  'copay-good':     '#052e16',
  'room-bad':       '#431407',
  'room-good':      '#052e16',
  'ped-bad':        '#1e1b4b',
  'ped-good':       '#052e16',
  'sublimits-bad':  '#2d1b4e',
  'cover':          '#1e3a5f',
  'insurer':        '#0f172a',
  'verdict':        '#0f172a',
};

const PolicyStoryModal = ({ analysis, model, insurerId, customerInfo, onClose }: Props) => {
  const ci = customerInfo ?? null;
  const [current, setCurrent] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  const cards = buildCards(model, analysis, ci, insurerId);
  const card  = cards[current];
  const total = cards.length;

  const bg = CARD_BGS[card.id]
    ?? (card.id.startsWith('strength') ? '#052e16'
      : card.id.startsWith('concern') ? '#1c1003'
      : '#0f172a');

  const goTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= total) return;
    setCurrent(idx);
    setAnimKey(k => k + 1);
  }, [total]);

  const handleNext = useCallback(() => {
    if (current >= total - 1) { onClose(); return; }
    goTo(current + 1);
  }, [current, total, goTo, onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') handleNext();
      if (e.key === 'ArrowLeft')  goTo(current - 1);
      if (e.key === 'Escape')     onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, goTo, handleNext, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden transition-colors duration-500"
      style={{ backgroundColor: bg }}
    >
      {/* Progress bar — segmented */}
      <div className="flex gap-1 px-5 pt-5 pb-0 flex-shrink-0">
        {cards.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full bg-white/70 transition-all duration-400"
              style={{ width: i <= current ? '100%' : '0%' }}
            />
          </div>
        ))}
      </div>

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-3 pb-2 flex-shrink-0">
        <span className="text-xs text-white/35 font-medium tabular-nums">
          {current + 1} of {total}
        </span>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X className="w-3.5 h-3.5 text-white/60" />
        </button>
      </div>

      {/* Scrollable card area */}
      <div className="flex-1 overflow-y-auto px-5 pb-5 pt-2">
        <div
          key={animKey}
          style={{ animation: 'enterUp 0.35s ease-out both' }}
        >
          <Card
            card={card}
            onNext={handleNext}
            isLast={current === total - 1}
          />
        </div>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5 py-4 flex-shrink-0">
        {cards.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === current ? '1.25rem' : '0.375rem',
              height: '0.375rem',
              backgroundColor: i === current ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)',
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default PolicyStoryModal;
