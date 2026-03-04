import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

export type FeatureRecord = {
  pdf: string;
  clause_id: number;
  page: number;
  type: string;
  name: string;
  quote: string;
  reference: string | null;
  notes?: string;
};

const DEFAULT_PATH = path.resolve(process.cwd(), 'dist/features/all_features_merged.jsonl');

let cache: FeatureRecord[] | null = null;
let cachePath: string | null = null;
let cacheMtimeMs: number | null = null;

async function loadAllFeatures(jsonlPath: string): Promise<FeatureRecord[]> {
  const st = fs.statSync(jsonlPath);
  if (cache && cachePath === jsonlPath && cacheMtimeMs === st.mtimeMs) return cache;

  const out: FeatureRecord[] = [];
  const stream = fs.createReadStream(jsonlPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    const l = line.trim();
    if (!l) continue;
    try {
      out.push(JSON.parse(l));
    } catch {
      // ignore bad lines
    }
  }

  cache = out;
  cachePath = jsonlPath;
  cacheMtimeMs = st.mtimeMs;
  return out;
}

function includesCI(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export const featuresRouter = Router();

featuresRouter.get('/features/meta', async (req, res) => {
  const jsonlPath = String(req.query.path ?? DEFAULT_PATH);
  if (!fs.existsSync(jsonlPath)) {
    return res.status(404).json({ error: `Missing features file at ${jsonlPath}. Run scripts/features_merge.mjs first.` });
  }

  const all = await loadAllFeatures(jsonlPath);
  const pdfs = new Set<string>();
  const types = new Set<string>();
  for (const r of all) {
    if (r.pdf) pdfs.add(r.pdf);
    if (r.type) types.add(r.type);
  }

  res.json({
    total: all.length,
    pdfs: [...pdfs].sort(),
    types: [...types].sort(),
  });
});

featuresRouter.get('/features', async (req, res) => {
  const jsonlPath = String(req.query.path ?? DEFAULT_PATH);
  if (!fs.existsSync(jsonlPath)) {
    return res.status(404).json({ error: `Missing features file at ${jsonlPath}. Run scripts/features_merge.mjs first.` });
  }

  const q = String(req.query.q ?? '').trim();
  const pdf = String(req.query.pdf ?? '').trim();
  const type = String(req.query.type ?? '').trim();
  const offset = Math.max(0, Number(req.query.offset ?? 0) || 0);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50) || 50));

  const all = await loadAllFeatures(jsonlPath);

  let filtered = all;
  if (pdf) filtered = filtered.filter(r => r.pdf === pdf);
  if (type) filtered = filtered.filter(r => r.type === type);
  if (q) {
    filtered = filtered.filter(r => includesCI(r.name ?? '', q) || includesCI(r.quote ?? '', q) || includesCI(r.notes ?? '', q));
  }

  const total = filtered.length;
  const items = filtered.slice(offset, offset + limit);

  res.json({ total, offset, limit, items });
});
