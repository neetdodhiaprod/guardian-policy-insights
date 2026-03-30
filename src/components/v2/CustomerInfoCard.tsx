import { User, Shield, CreditCard, Calendar, AlertCircle, Users } from 'lucide-react';
import { CustomerInfo } from '@/lib/mockData';
import { PremiumVerdict, CoverageVerdict, formatINR, resolveTier } from '@/data/benchmarks';

interface CustomerInfoCardProps {
  info: CustomerInfo;
  premiumVerdict: PremiumVerdict;
  coverageVerdict: CoverageVerdict;
}

function Badge({ verdict, type }: { verdict: PremiumVerdict | CoverageVerdict; type: 'premium' | 'coverage' }) {
  if (verdict === 'UNKNOWN') return null;

  const config = {
    ADEQUATE:    { bg: 'bg-great-bg text-great-text border-great-border',     text: 'Adequate for your city'           },
    LOW:         { bg: 'bg-bad-bg text-bad-text border-bad-border',           text: 'May be low — consider topping up' },
    FAIR:        { bg: 'bg-great-bg text-great-text border-great-border',     text: 'Fair rate for your age'           },
    OVERPAYING:  { bg: 'bg-unclear-bg text-unclear-text border-unclear-border', text: 'You may be overpaying'          },
    UNDERPAYING: { bg: 'bg-bad-bg text-bad-text border-bad-border',           text: 'Suspiciously low — verify cover'  },
  } as const;

  const c = config[verdict as keyof typeof config];
  if (!c) return null;

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-xs border ${c.bg}`}>
      {c.text}
    </span>
  );
}

function formatPolicyDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  // "02/08/2025 15:51 hrs To 01/08/2026" → "02 Aug 2025 – 01 Aug 2026"
  const parts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4}).*?(\d{2})\/(\d{2})\/(\d{4})/);
  if (parts) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const m1 = months[parseInt(parts[2]) - 1];
    const m2 = months[parseInt(parts[5]) - 1];
    return `${parts[1]} ${m1} ${parts[3]} – ${parts[4]} ${m2} ${parts[6]}`;
  }
  // Single date
  const single = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (single) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `From ${single[1]} ${months[parseInt(single[2]) - 1]} ${single[3]}`;
  }
  return dateStr;
}

function cleanName(name: string | null): string | null {
  if (!name) return null;
  // Remove titles like Mr, Mrs, Ms, Dr, etc.
  return name.replace(/^(Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Miss)\s+/i, '').trim();
}

const CustomerInfoCard = ({ info, premiumVerdict, coverageVerdict }: CustomerInfoCardProps) => {
  const displayName = cleanName(info.customerName);
  const siFormatted = formatINR(info.sumInsured);
  const premFormatted = info.totalPremium ? `₹${parseInt(info.totalPremium).toLocaleString('en-IN')}` : null;
  const tier = resolveTier(info.premiumTier, info.city);
  const period = formatPolicyDate(info.policyPeriod);

  // Members list with ages
  const memberList = info.members.map(m => {
    const parts = m.dob.split('/');
    const age = parts.length === 3 ? new Date().getFullYear() - parseInt(parts[2]) : null;
    const firstName = m.name.split(' ')[0];
    return age ? `${firstName} (${age})` : firstName;
  });

  return (
    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border bg-surface-sunken/40">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-muted-foreground" />
          <span className="label-editorial text-muted-foreground">
            Your policy at a glance
          </span>
        </div>
      </div>

      <div className="px-6 py-5 space-y-3.5">
        {/* Name */}
        {displayName && (
          <div className="flex items-start gap-3">
            <span className="w-20 text-xs text-muted-foreground flex-shrink-0 pt-0.5">Name</span>
            <span className="text-sm font-semibold text-foreground">{displayName}</span>
          </div>
        )}

        {/* Members (for floaters) */}
        {memberList.length > 1 && (
          <div className="flex items-start gap-3">
            <span className="w-20 text-xs text-muted-foreground flex-shrink-0 pt-0.5">
              <Users className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              Members
            </span>
            <span className="text-sm text-foreground">{memberList.join(', ')}</span>
          </div>
        )}

        {/* Cover */}
        {siFormatted && (
          <div className="flex items-start gap-3">
            <span className="w-20 text-xs text-muted-foreground flex-shrink-0 pt-0.5">
              <Shield className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              Cover
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{siFormatted}</span>
              <Badge verdict={coverageVerdict} type="coverage" />
            </div>
          </div>
        )}

        {/* Premium */}
        {premFormatted && (
          <div className="flex items-start gap-3">
            <span className="w-20 text-xs text-muted-foreground flex-shrink-0 pt-0.5">
              <CreditCard className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              Premium
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{premFormatted}/yr</span>
              <Badge verdict={premiumVerdict} type="premium" />
            </div>
          </div>
        )}

        {/* Policy period */}
        {period && (
          <div className="flex items-start gap-3">
            <span className="w-20 text-xs text-muted-foreground flex-shrink-0 pt-0.5">
              <Calendar className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              Period
            </span>
            <span className="text-sm text-foreground">{period}</span>
          </div>
        )}

        {/* Pre-existing diseases */}
        {info.preExistingDiseases.length > 0 && (
          <div className="flex items-start gap-3">
            <span className="w-20 text-xs text-muted-foreground flex-shrink-0 pt-0.5">
              <AlertCircle className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              PED
            </span>
            <div className="flex flex-wrap gap-1.5">
              {info.preExistingDiseases.map((d, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded-xs bg-unclear-bg text-unclear-text border border-unclear-border capitalize">
                  {d.toLowerCase()}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* City / tier context */}
        {(info.city || info.premiumTier) && (
          <p className="text-xs text-muted-foreground pt-1 border-t border-border/40">
            {info.city && <span>{info.city}</span>}
            {info.city && info.premiumTier && <span> · </span>}
            {tier && <span>Premium {tier} city — coverage benchmark ₹{tier === 'Tier1' ? '10' : tier === 'Tier2' ? '5' : '3'} Lakhs minimum</span>}
          </p>
        )}
      </div>
    </div>
  );
};

export default CustomerInfoCard;
