import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.resolve(process.cwd(), 'out');

function safePart(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '');
}

export const outRouter = Router();

outRouter.get('/out/meta', async (_req, res) => {
  if (!fs.existsSync(OUT_DIR)) {
    return res.status(404).json({ error: `Missing out dir at ${OUT_DIR}` });
  }

  const insurers = fs
    .readdirSync(OUT_DIR)
    .filter((d) => fs.statSync(path.join(OUT_DIR, d)).isDirectory())
    .sort();

  const policiesByInsurer: Record<string, string[]> = {};
  for (const insurer of insurers) {
    const dir = path.join(OUT_DIR, insurer);
    const policies = fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith('.json'))
      .map((f) => f.replace(/\.json$/i, ''))
      .sort();
    policiesByInsurer[insurer] = policies;
  }

  res.json({ insurers, policiesByInsurer });
});

outRouter.get('/out', async (req, res) => {
  const insurer = String(req.query.insurer ?? '').trim();
  const policy = String(req.query.policy ?? '').trim();
  if (!insurer || !policy) {
    return res.status(400).json({ error: 'Missing required query params: insurer, policy' });
  }

  const safeInsurer = safePart(insurer);
  const safePolicy = safePart(policy);
  const filePath = path.join(OUT_DIR, safeInsurer, `${safePolicy}.json`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: `Missing out JSON at ${filePath}` });
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    res.json({ insurer: safeInsurer, policy: safePolicy, data });
  } catch (e: any) {
    res.status(500).json({ error: `Failed to parse JSON: ${String(e?.message ?? e)}` });
  }
});
