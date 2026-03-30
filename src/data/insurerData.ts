// FY 2023-24 insurer performance data (source: IRDAI Annual Report 2023-24)
// ICR = Incurred Claims Ratio; CSR = Claim Settlement Ratio

export interface InsurerMetric {
  value: string;
  grade: 'great' | 'good' | 'neutral' | 'bad';
  blurb: string;
}

export interface InsurerData {
  displayName: string;
  icr: InsurerMetric;
  csr: InsurerMetric;
  hospitals: InsurerMetric;
  complaints: InsurerMetric;
  take: string;
}

function icrGrade(pct: number): 'great' | 'good' | 'neutral' {
  if (pct <= 65) return 'great';
  if (pct <= 80) return 'good';
  return 'neutral';
}

function csrGrade(pct: number): 'great' | 'good' | 'bad' {
  if (pct >= 97) return 'great';
  if (pct >= 90) return 'good';
  return 'bad';
}

function hospitalsGrade(count: number): 'great' | 'good' | 'neutral' {
  if (count >= 15000) return 'great';
  if (count >= 10000) return 'good';
  return 'neutral';
}

function complaintsGrade(per10k: number | null): 'great' | 'good' | 'bad' | 'neutral' {
  if (per10k === null) return 'neutral';
  if (per10k < 15) return 'great';
  if (per10k < 30) return 'good';
  return 'bad';
}

export const INSURER_DATA: Record<string, InsurerData> = {
  'aditya-birla': {
    displayName: 'Aditya Birla Health Insurance',
    take: 'One of the more reliable choices in this space. A 99% settlement rate with only 12 complaints per 10,000 claims is a rare combination — most insurers trade one for the other. Their Active Health platform also nudges you towards preventive care, which is genuinely useful. If the policy terms suit you, this is a solid long-term insurer.',
    icr: {
      value: '68%',
      grade: icrGrade(68),
      blurb: 'Aditya Birla pays out ₹68 for every ₹100 collected in premiums, reflecting solid claims efficiency.',
    },
    csr: {
      value: '99%',
      grade: csrGrade(99),
      blurb: 'Aditya Birla settles 99% of all valid claims, demonstrating strong payout reliability.',
    },
    hospitals: {
      value: '15,000+',
      grade: hospitalsGrade(15000),
      blurb: 'A wide cashless network with over 15,000 empanelled hospitals across India.',
    },
    complaints: {
      value: '12 per 10k claims',
      grade: complaintsGrade(12),
      blurb: 'Low complaint volume — fewer than 12 grievances per 10,000 claims registered.',
    },
  },
  'care': {
    displayName: 'Care Health Insurance',
    take: 'The network is unmatched — 22,000+ hospitals is genuinely best-in-class and matters a lot for cashless access outside metros. But the 42 complaints per 10,000 claims is a concern; it suggests claim disputes are common, possibly due to aggressive document requirements or sub-limit application. Go in with your paperwork in order and know exactly what you\'re covered for before you need it.',
    icr: {
      value: '58%',
      grade: icrGrade(58),
      blurb: 'Care Health pays out ₹58 for every ₹100 collected — one of the lowest ICRs among health insurers.',
    },
    csr: {
      value: '93%',
      grade: csrGrade(93),
      blurb: 'Care Health settles 93% of valid claims, though some complex cases may take longer.',
    },
    hospitals: {
      value: '22,000+',
      grade: hospitalsGrade(22000),
      blurb: 'Largest cashless network among standalone health insurers — 22,000+ hospitals nationwide.',
    },
    complaints: {
      value: '42 per 10k claims',
      grade: complaintsGrade(42),
      blurb: 'Above-average complaint rate — 42 per 10,000 claims, higher than the industry benchmark.',
    },
  },
  'hdfc-ergo': {
    displayName: 'HDFC ERGO General Insurance',
    take: 'A dependable insurer with no obvious weak spots. 98% settlement, low complaints, and a solid hospital network — this is what a steady, trustworthy insurer looks like. They are not flashy and their product range is not the most innovative, but when you actually need to file a claim, that track record is what counts.',
    icr: {
      value: '79%',
      grade: icrGrade(79),
      blurb: 'HDFC ERGO pays out ₹79 for every ₹100 collected — close to the industry average, indicating active claims.',
    },
    csr: {
      value: '98%',
      grade: csrGrade(98),
      blurb: 'HDFC ERGO settles 98% of all valid claims, with a consistent track record over 3 years.',
    },
    hospitals: {
      value: '13,000+',
      grade: hospitalsGrade(13000),
      blurb: 'HDFC ERGO has a strong network with over 13,000 hospitals ensuring wide cashless access.',
    },
    complaints: {
      value: '15 per 10k claims',
      grade: complaintsGrade(15),
      blurb: 'Low complaint rate — 15 per 10,000 claims, close to the industry best.',
    },
  },
  'icici-lombard': {
    displayName: 'ICICI Lombard General Insurance',
    take: 'Strong settlement ratio and a well-known brand, but the hospital network at 10,000+ is noticeably smaller than peers — check that your preferred hospitals are covered before committing. The lack of published complaint data is a minor flag; it does not mean complaints are high, but transparency matters when you\'re evaluating trust.',
    icr: {
      value: '71%',
      grade: icrGrade(71),
      blurb: 'ICICI Lombard pays out ₹71 for every ₹100 collected — efficient claims management.',
    },
    csr: {
      value: '99%',
      grade: csrGrade(99),
      blurb: 'ICICI Lombard settles 99% of all valid claims, one of the highest ratios in the industry.',
    },
    hospitals: {
      value: '10,000+',
      grade: hospitalsGrade(10000),
      blurb: 'Decent cashless hospital network with 10,000+ empanelled facilities across India.',
    },
    complaints: {
      value: 'Not disclosed',
      grade: complaintsGrade(null),
      blurb: 'Complaint data per 10,000 claims not separately published for the health segment.',
    },
  },
  'niva-bupa': {
    displayName: 'Niva Bupa Health Insurance',
    take: 'Niva Bupa stands out for one thing above all else: fewer than 8 complaints per 10,000 claims is exceptional. It tells you that when claims do get filed, they tend to get resolved cleanly. The 92% CSR is slightly below top-tier, suggesting they apply terms more strictly — but the low dispute rate means policyholders generally feel the decisions are fair.',
    icr: {
      value: '54%',
      grade: icrGrade(54),
      blurb: 'Niva Bupa has the lowest ICR in this group — pays ₹54 per ₹100 collected. Very capital-efficient.',
    },
    csr: {
      value: '92%',
      grade: csrGrade(92),
      blurb: 'Niva Bupa settles 92% of valid claims — solid, though slightly below top-tier peers.',
    },
    hospitals: {
      value: '10,000+',
      grade: hospitalsGrade(10000),
      blurb: 'Niva Bupa has a good network with 10,000+ cashless hospitals across India.',
    },
    complaints: {
      value: '8 per 10k claims',
      grade: complaintsGrade(8),
      blurb: 'Very low complaint rate — under 8 grievances per 10,000 claims, among the best in class.',
    },
  },
  'star-health-care': {
    displayName: 'Star Health and Allied Insurance',
    take: 'Star Health has the numbers that look good on paper — 99% CSR, 14,000+ hospitals — but 52 complaints per 10,000 claims is a serious concern. It is the highest in this group by a large margin and suggests frequent post-claim disputes. Our read: they settle a lot of claims, but policyholders regularly feel shortchanged on the amount. Go in knowing your policy terms in detail.',
    icr: {
      value: '67%',
      grade: icrGrade(67),
      blurb: 'Star Health pays out ₹67 for every ₹100 collected — broadly in line with health-only insurer benchmarks.',
    },
    csr: {
      value: '99%',
      grade: csrGrade(99),
      blurb: 'Star Health settles 99% of all valid claims — among the highest settlement ratios in the country.',
    },
    hospitals: {
      value: '14,000+',
      grade: hospitalsGrade(14000),
      blurb: 'Star Health has one of the largest cashless networks in India with 14,000+ hospitals.',
    },
    complaints: {
      value: '52 per 10k claims',
      grade: complaintsGrade(52),
      blurb: 'High complaint volume — 52 per 10,000 claims, significantly above the recommended benchmark of 20.',
    },
  },
};
