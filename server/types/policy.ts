export type PolicyTakeItem = {
  name: string;
  quote: string;
  reference: string;
  explanation: string;
};

export type PolicyVariantMetadata = {
  planVariantId: string;
  insurerKey: string;
  insurerDisplayName: string;
  productName: string;
  variantName: string;
  sourcePdfPath?: string;
  updatedAt: string;
};

export type GuardianTake = {
  great: PolicyTakeItem[];
  good: PolicyTakeItem[];
  redFlags: PolicyTakeItem[];
  needsClarification: PolicyTakeItem[];
};

export type PolicyVariantRecord = {
  metadata: PolicyVariantMetadata;
  guardianTake: GuardianTake;
  status: 'draft' | 'approved';
};
