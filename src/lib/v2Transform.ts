import { PolicyAnalysis, PolicyFeature } from '@/lib/mockData';
import { getFeatureWeight, FeatureTier } from '@/data/featureWeights';

export type FeatureGrade = 'great' | 'good' | 'bad' | 'unclear';
export type Verdict = 'DANGER' | 'COVERED' | 'PROTECTED' | 'CHECK';

export interface V2Feature {
  raw: PolicyFeature;
  grade: FeatureGrade;
  tier: FeatureTier;
  weight: 3 | 2 | 1;
  displayName: string;
  icon: string;
  verdict: Verdict;
  impactStatement: string;
  actionRecommendation?: string;
}

export interface UnclassifiedFeature {
  grade: FeatureGrade;
  feature: PolicyFeature;
}

export interface V2Model {
  shieldScore: number;
  scoreLabel: string;
  scoreDescription: string;
  critical: V2Feature[];
  important: V2Feature[];
  niceToHave: V2Feature[];
  unclassified: UnclassifiedFeature[];
  badCriticalFeatures: V2Feature[];
  badImportantFeatures: V2Feature[];
}

const GRADE_MULTIPLIER: Record<FeatureGrade, number> = {
  great: 1.0,
  good: 0.65,
  unclear: 0.3,
  bad: 0.0,
};

function gradeToVerdict(grade: FeatureGrade): Verdict {
  if (grade === 'bad') return 'DANGER';
  if (grade === 'unclear') return 'CHECK';
  if (grade === 'good') return 'COVERED';
  return 'PROTECTED';
}

const SORT_ORDER: FeatureGrade[] = ['bad', 'unclear', 'good', 'great'];

function sortByGrade(a: V2Feature, b: V2Feature) {
  return SORT_ORDER.indexOf(a.grade) - SORT_ORDER.indexOf(b.grade);
}

export function buildV2Model(analysis: PolicyAnalysis): V2Model {
  const allGraded: Array<{ grade: FeatureGrade; feature: PolicyFeature }> = [];
  for (const grade of ['great', 'good', 'bad', 'unclear'] as FeatureGrade[]) {
    for (const f of analysis.features[grade]) {
      allGraded.push({ grade, feature: f });
    }
  }

  const critical: V2Feature[] = [];
  const important: V2Feature[] = [];
  const niceToHave: V2Feature[] = [];
  const unclassified: UnclassifiedFeature[] = [];

  let earned = 0;
  let possible = 0;

  for (const { grade, feature } of allGraded) {
    const weightConfig = getFeatureWeight(feature.name);
    if (!weightConfig) {
      unclassified.push({ grade, feature });
      continue;
    }

    const verdict = gradeToVerdict(grade);
    const impactStatement =
      grade === 'bad' || grade === 'unclear'
        ? weightConfig.badImpact
        : weightConfig.goodImpact;

    const v2Feature: V2Feature = {
      raw: feature,
      grade,
      tier: weightConfig.tier,
      weight: weightConfig.weight,
      displayName: weightConfig.displayName,
      icon: weightConfig.icon,
      verdict,
      impactStatement,
      actionRecommendation: grade === 'bad' ? weightConfig.actionIfBad : undefined,
    };

    earned += GRADE_MULTIPLIER[grade] * weightConfig.weight;
    possible += weightConfig.weight;

    if (weightConfig.tier === 'critical') critical.push(v2Feature);
    else if (weightConfig.tier === 'important') important.push(v2Feature);
    else niceToHave.push(v2Feature);
  }

  const rawScore = possible > 0 ? (earned / possible) * 100 : 0;
  // Penalise each critical DANGER feature — each one multiplies by 0.8
  const criticalDangerCount = critical.filter(f => f.grade === 'bad').length;
  const dangerMultiplier = Math.pow(0.8, criticalDangerCount);
  const penalisedScore = rawScore * dangerMultiplier;
  // Clamp to 70 if fewer than 3 matched features (sparse data)
  const matchedCount = critical.length + important.length + niceToHave.length;
  const shieldScore = matchedCount < 3
    ? Math.min(Math.round(penalisedScore), 70)
    : Math.round(penalisedScore);

  const scoreLabel =
    shieldScore >= 80 ? 'Strong Cover' :
    shieldScore >= 60 ? 'Good Cover' :
    shieldScore >= 40 ? 'Average Cover' :
    'High Risk';

  const scoreDescription =
    shieldScore >= 80 ? null :
    shieldScore >= 60 ? 'Solid coverage with a few areas worth reviewing.' :
    shieldScore >= 40 ? 'Some gaps could increase your out-of-pocket costs significantly.' :
    'Critical structural weaknesses — read the action plan carefully.';

  return {
    shieldScore,
    scoreLabel,
    scoreDescription,
    critical: critical.sort(sortByGrade),
    important: important.sort(sortByGrade),
    niceToHave: niceToHave.sort(sortByGrade),
    unclassified,
    badCriticalFeatures: critical.filter(f => f.grade === 'bad'),
    badImportantFeatures: important.filter(f => f.grade === 'bad'),
  };
}
