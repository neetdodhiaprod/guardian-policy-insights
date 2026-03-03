export interface PolicyFeature {
  name: string;
  quote: string;
  reference: string;
  explanation: string;
}

export interface AnalysisResult {
  policyName: string;
  insurer: string;
  sumInsured: string;
  policyType: string;
  documentType: string;
  summary: {
    great: number;
    good: number;
    bad: number;
    unclear: number;
  };
  features: {
    great: PolicyFeature[];
    good: PolicyFeature[];
    bad: PolicyFeature[];
    unclear: PolicyFeature[];
  };
  disclaimer: string;
}

export class PolicyAnalysisError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'PolicyAnalysisError';
  }
}

export async function analyzePolicyWithAI(policyText: string): Promise<AnalysisResult> {
  const res = await fetch('/api/analyze-policy', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ policyText }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new PolicyAnalysisError(data?.error || 'Failed to analyze policy', res.status);
  }

  return data as AnalysisResult;
}
