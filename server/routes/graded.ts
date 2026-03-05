import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_DIR = path.resolve(process.cwd(), 'dist/graded');

function safeBaseName(name: string) {
  // prevent path traversal; allow only simple filenames.
  return name.replace(/[^a-zA-Z0-9._-]/g, '');
}

export const gradedRouter = Router();

gradedRouter.get('/graded/meta', async (req, res) => {
  const dir = String(req.query.dir ?? DEFAULT_DIR);
  if (!fs.existsSync(dir)) {
    return res.status(404).json({ error: `Missing graded dir at ${dir}.` });
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.json'))
    .sort();

  res.json({ dir, total: files.length, pdfs: files.map((f) => f.replace(/\.json$/i, '')) });
});

gradedRouter.get('/graded', async (req, res) => {
  const dir = String(req.query.dir ?? DEFAULT_DIR);
  const pdf = String(req.query.pdf ?? '').trim();
  if (!pdf) return res.status(400).json({ error: 'Missing required query param: pdf' });

  const safe = safeBaseName(pdf);
  const filePath = path.join(dir, `${safe}.json`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: `Missing graded file at ${filePath}` });
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    res.json({ pdf: safe, data });
  } catch (e: any) {
    res.status(500).json({ error: `Failed to read/parse graded JSON: ${String(e?.message ?? e)}` });
  }
});
