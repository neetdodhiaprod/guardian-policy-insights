import { AlertTriangle, CheckCircle2, Users, IndianRupee, TrendingUp, TrendingDown } from 'lucide-react';
import { PolicyAnalysis, CustomerInfo } from '@/lib/mockData';
import { V2Model, V2Feature } from '@/lib/v2Transform';

interface PolicyIdentityCardProps {
  analysis: PolicyAnalysis;
  model: V2Model;
  insurerId: string;
  insurerColor?: string;
  customerInfo?: CustomerInfo | null;
}

const INSURER_MONO: Record<string, string> = {
  'aditya-birla':     'AB',
  'care':             'CH',
  'hdfc-ergo':        'HE',
  'icici-lombard':    'IL',
  'niva-bupa':        'NB',
  'star-health-care': 'SH',
};

function getPolicyTypeChips(analysis: PolicyAnalysis, ci: CustomerInfo | null): string[] {
  if (ci) return [ci.members.length > 1 ? 'Family Floater' : 'Individual'];
  if (!analysis.policyType || analysis.policyType === 'Not specified') return [];
  return analysis.policyType.split(/\s*[|/]\s*/).map(s => s.trim()).filter(Boolean);
}

function getProtection(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Excellent', color: 'text-great-text' };
  if (score >= 60) return { label: 'Good',      color: 'text-covered-text' };
  if (score >= 40) return { label: 'Moderate',  color: 'text-unclear-text' };
  return               { label: 'Poor',       color: 'text-bad-text' };
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-great-text';
  if (score >= 60) return 'text-covered-text';
  if (score >= 40) return 'text-unclear-text';
  return 'text-bad-text';
}

function getVerdictHeadline(score: number, badCritical: V2Feature[]): { headline: string; sub: string | null } {
  if (badCritical.length >= 2) {
    const names = badCritical.slice(0, 2).map(f => f.displayName.toLowerCase()).join(' and ');
    return {
      headline: 'This policy has critical gaps.',
      sub: `${names} could significantly reduce your claim payout.`,
    };
  }
  if (badCritical.length === 1) {
    return {
      headline: 'Your policy offers moderate protection.',
      sub: `The ${badCritical[0].displayName.toLowerCase()} clause could increase your hospital bill.`,
    };
  }
  if (score >= 80) return { headline: 'Your policy is well-structured.',      sub: 'Most hospitalisation scenarios are covered with minimal out-of-pocket cost.' };
  if (score >= 60) return { headline: 'Your policy offers good protection.',   sub: 'A few areas worth verifying before your next claim.' };
  return               { headline: 'Your policy offers average protection.', sub: 'Review the key factors to understand your out-of-pocket exposure.' };
}

function getBullets(model: V2Model): Array<{ positive: boolean; text: string }> {
  if (model.badCriticalFeatures.length > 0) {
    return [{ positive: false, text: model.badCriticalFeatures[0].impactStatement }];
  }
  return [];
}

function formatSI(sumInsured: string): string {
  const n = parseInt(sumInsured);
  if (isNaN(n)) return sumInsured;
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)} Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(0)} Lakh`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function getCoverageAdequacy(sumInsured: string, memberCount: number): { text: string; color: string; Icon: React.ComponentType<{ className?: string }> } {
  const si = parseInt(sumInsured);
  if (isNaN(si)) return { text: 'Coverage details unavailable', color: 'text-muted-foreground', Icon: IndianRupee };
  const perPerson = si / Math.max(memberCount, 1);
  if (perPerson >= 700000) return { text: 'Good coverage for your family size',           color: 'text-great-text',   Icon: TrendingUp   };
  if (perPerson >= 300000) return { text: 'Adequate — sufficient for most hospitalisations', color: 'text-covered-text', Icon: CheckCircle2 };
  return                          { text: 'May be insufficient for a serious illness or surgery', color: 'text-bad-text',    Icon: TrendingDown };
}

const PolicyIdentityCard = ({
  analysis, model, insurerId, insurerColor = '#64748b', customerInfo,
}: PolicyIdentityCardProps) => {
  const ci = customerInfo ?? null;
  const typeChips = getPolicyTypeChips(analysis, ci);

  const mono       = INSURER_MONO[insurerId] ?? insurerId.slice(0, 2).toUpperCase();
  const protection = getProtection(model.shieldScore);
  const scoreColor = getScoreColor(model.shieldScore);
  const verdict    = getVerdictHeadline(model.shieldScore, model.badCriticalFeatures);
  const bullets    = getBullets(model);
  const keyRisk    = model.badCriticalFeatures[0]?.displayName ?? null;

  // Insured profile data
  const memberList = (ci?.members ?? []).map(m => {
    const y = m.dob?.split('/')?.[2];
    const age = y && +y > 1900 ? new Date().getFullYear() - +y : null;
    return age ? `${m.name} (${age})` : m.name;
  });
  const siFormatted   = ci?.sumInsured ? formatSI(ci.sumInsured) : null;
  const premFormatted = ci?.totalPremium ? `₹${parseInt(ci.totalPremium).toLocaleString('en-IN')} / year` : null;
  const coverage      = ci?.sumInsured ? getCoverageAdequacy(ci.sumInsured, memberList.length || 1) : null;
  const showProfile   = !!(ci && memberList.length > 0);

  return (
    <div
      className="rounded-xl border border-border shadow-card overflow-hidden bg-card"
      style={{ borderTop: `4px solid ${insurerColor}` }}
    >
      {/* Policy identity strip */}
      <div className="px-6 pt-6 pb-5 flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-sm flex-shrink-0 flex items-center justify-center text-white font-bold text-sm"
          style={{ background: insurerColor }}
        >
          {mono}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-[0.06em]">{analysis.insurer}</p>
          <h2 className="font-display text-xl md:text-2xl text-foreground leading-tight mt-0.5">{analysis.policyName}</h2>
          {typeChips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {typeChips.map(t => (
                <span key={t} className="text-xs font-medium bg-surface-sunken text-muted-foreground px-2.5 py-0.5 rounded-xs border border-border">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Verdict — doctor diagnosis headline */}
      <div className="px-6 py-6 border-t border-border bg-surface-sunken/30">
        <p className="font-display text-2xl md:text-3xl text-foreground leading-tight">
          {verdict.headline}
        </p>
        {verdict.sub && (
          <p className="text-sm text-muted-foreground leading-relaxed mt-2">
            {verdict.sub}
          </p>
        )}
      </div>

      {/* Three stat blocks: Score | Protection | Key Risk */}
      <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
        <div className="px-4 py-5 text-center">
          <p className="label-editorial text-muted-foreground mb-2">Policy Score</p>
          <p className={`font-display text-3xl font-tnum leading-none ${scoreColor}`}>
            {model.shieldScore}
            <span className="text-base text-muted-foreground font-normal">/100</span>
          </p>
        </div>
        <div className="px-4 py-5 text-center">
          {siFormatted && coverage ? (
            <>
              <p className="label-editorial text-muted-foreground mb-2">Sum Insured</p>
              <p className={`font-display text-2xl font-tnum leading-none ${coverage.color}`}>
                {siFormatted}
              </p>
              <p className={`text-[10px] font-semibold mt-1.5 leading-tight ${coverage.color}`}>
                {coverage.text}
              </p>
            </>
          ) : (
            <>
              <p className="label-editorial text-muted-foreground mb-2">Protection</p>
              <p className={`font-display text-2xl leading-none ${protection.color}`}>
                {protection.label}
              </p>
            </>
          )}
        </div>
        <div className="px-4 py-5 text-center">
          {premFormatted ? (
            <>
              <p className="label-editorial text-muted-foreground mb-2">Annual Premium</p>
              <p className="font-display text-2xl font-tnum leading-none text-foreground">
                {premFormatted.replace(' / year', '')}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1.5">per year</p>
            </>
          ) : (
            <>
              <p className="label-editorial text-muted-foreground mb-2">Key Risk</p>
              <p className={`text-sm font-semibold leading-snug ${keyRisk ? 'text-bad-text' : 'text-great-text'}`}>
                {keyRisk ?? 'None detected'}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Risk bullet — only shown when a critical risk exists */}
      {bullets.length > 0 && (
        <div className="px-6 py-4 border-t border-border">
          {bullets.map((b, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-bad-text flex-shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/80 leading-snug">{b.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Insured profile — only for uploaded docs */}
      {showProfile && (
        <div className="border-t border-border bg-surface-sunken/30 px-6 py-5 space-y-4">
          <p className="label-editorial text-muted-foreground">Insured Profile</p>

          {/* Members covered */}
          {memberList.length > 0 && (
            <div className="flex items-start gap-2.5">
              <Users className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-xs text-muted-foreground mr-2">People covered</span>
                <span className="text-sm text-foreground">{memberList.join(', ')}</span>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default PolicyIdentityCard;
