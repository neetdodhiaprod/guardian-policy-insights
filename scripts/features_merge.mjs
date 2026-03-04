#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

async function listFeatureFiles(dir) {
  const ents = await fsp.readdir(dir, { withFileTypes: true });
  return ents
    .filter(e => e.isFile() && e.name.endsWith('.features.jsonl'))
    .map(e => path.join(dir, e.name))
    .sort();
}

function readJsonlLines(file) {
  const txt = fs.readFileSync(file, 'utf8');
  return txt.split(/\n/).filter(Boolean).map(l => JSON.parse(l));
}

async function main() {
  const inDir = process.argv[2] ?? 'dist/features/features_raw';
  const outPath = process.argv[3] ?? 'dist/features/all_features_merged.jsonl';
  const summaryPath = process.argv[4] ?? 'dist/features/all_features_summary.csv';

  await fsp.mkdir(path.dirname(outPath), { recursive: true });

  const files = await listFeatureFiles(inDir);
  const out = fs.createWriteStream(outPath, { flags: 'w' });

  const summary = [];
  let total = 0;

  for (const file of files) {
    const pdf = path.basename(file).replace(/\.features\.jsonl$/, '');
    const rows = readJsonlLines(file);
    const countsByType = {};
    for (const r of rows) {
      const type = r.type ?? 'unknown';
      countsByType[type] = (countsByType[type] ?? 0) + 1;
      out.write(JSON.stringify({ pdf, ...r }) + '\n');
      total++;
    }
    summary.push({ pdf, features: rows.length, ...countsByType });
  }

  out.end();

  // Write a wide CSV summary.
  const allTypes = new Set();
  for (const s of summary) {
    for (const k of Object.keys(s)) if (!['pdf', 'features'].includes(k)) allTypes.add(k);
  }
  const typeCols = [...allTypes].sort();
  const header = ['pdf', 'features', ...typeCols];
  const lines = [header.join(',')];
  for (const s of summary) {
    const row = [s.pdf, s.features, ...typeCols.map(t => s[t] ?? 0)];
    lines.push(row.map(v => JSON.stringify(v)).join(','));
  }
  await fsp.writeFile(summaryPath, lines.join('\n') + '\n', 'utf8');

  console.error(`Merged ${files.length} PDFs, total features=${total}`);
  console.error(`Wrote: ${outPath}`);
  console.error(`Wrote: ${summaryPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
