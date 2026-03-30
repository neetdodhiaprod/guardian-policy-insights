export interface DefaultPolicy {
  policyId: string;
  premiumCalcUrl: string;
}

export const DEFAULT_POLICIES: Record<string, DefaultPolicy> = {
  'aditya-birla': {
    policyId: 'Activ_One_MAX',
    premiumCalcUrl: 'https://www.adityabirlacapital.com/health-insurance/calculate-premium',
  },
  'care': {
    policyId: 'Care_Supreme',
    premiumCalcUrl: 'https://www.careinsurance.com/buy-health-insurance.html',
  },
  'hdfc-ergo': {
    policyId: 'Optima_Secure',
    premiumCalcUrl: 'https://www.hdfcergo.com/health-insurance/optima-secure.html',
  },
  'icici-lombard': {
    policyId: 'Elevate',
    premiumCalcUrl: 'https://www.icicilombard.com/health-insurance/buy-health-insurance',
  },
  'niva-bupa': {
    policyId: 'ReAssure_2_Titanium_Plus',
    premiumCalcUrl: 'https://www.nivabupa.com/health-insurance-plans/reassure.html',
  },
  'star-health-care': {
    policyId: 'Comprehensive',
    premiumCalcUrl: 'https://www.starhealth.in/health-insurance/comprehensive-insurance-policy',
  },
};
