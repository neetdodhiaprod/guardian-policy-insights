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
  updatedAt?: string;
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

const LS_KEY = 'guardian_admin_key';

export function getAdminKey(): string | null {
  return localStorage.getItem(LS_KEY);
}

export function setAdminKey(key: string) {
  localStorage.setItem(LS_KEY, key);
}

export function clearAdminKey() {
  localStorage.removeItem(LS_KEY);
}

async function adminFetch(path: string, init: RequestInit = {}) {
  const key = getAdminKey();
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json');
  if (key) headers.set('x-admin-key', key);

  const res = await fetch(path, { ...init, headers });
  if (res.status === 401) throw new Error('Unauthorized: admin key missing/invalid');
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export async function listVariants(): Promise<{ items: Pick<PolicyVariantRecord,'metadata'|'status'>[] }> {
  return adminFetch('/api/admin/variants');
}

export async function getVariant(planVariantId: string): Promise<{ item: PolicyVariantRecord | null }> {
  return adminFetch(`/api/admin/variants/${encodeURIComponent(planVariantId)}`);
}

export async function saveVariant(planVariantId: string, record: PolicyVariantRecord): Promise<{ ok: true }> {
  return adminFetch(`/api/admin/variants/${encodeURIComponent(planVariantId)}`, {
    method: 'POST',
    body: JSON.stringify(record),
  });
}

export async function approveVariant(planVariantId: string): Promise<{ ok: true; matched: number }> {
  return adminFetch(`/api/admin/variants/${encodeURIComponent(planVariantId)}/approve`, { method: 'POST' });
}
