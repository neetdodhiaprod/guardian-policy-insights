#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

async function listPdfs(root) {
  const out = [];
  async function walk(dir) {
    const ents = await fs.readdir(dir, { withFileTypes: true });
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.isFile() && p.toLowerCase().endsWith('.pdf')) out.push(p);
    }
  }
  await walk(root);
  out.sort();
  return out;
}

function runOne(pdfPath, outPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/extract_clauses_pdfjs.mjs', pdfPath, outPath], {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    child.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`Extractor failed (${code}) for ${pdfPath}`));
    });
  });
}

async function main() {
  const pdfRoot = process.argv[2] ?? 'policy-wording';
  const outDir = process.argv[3] ?? 'dist/features/clauses';

  await fs.mkdir(outDir, { recursive: true });
  const pdfs = await listPdfs(pdfRoot);

  console.error(`Found ${pdfs.length} PDFs under ${pdfRoot}`);

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < pdfs.length; i++) {
    const pdfPath = pdfs[i];
    const base = path.basename(pdfPath).replace(/\.pdf$/i, '');
    const safeBase = base.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const outPath = path.join(outDir, `${safeBase}.clauses.jsonl`);

    console.error(`\n[${i + 1}/${pdfs.length}] ${pdfPath} -> ${outPath}`);
    try {
      await runOne(pdfPath, outPath);
      ok++;
    } catch (e) {
      fail++;
      console.error(String(e?.stack ?? e));
      // continue
    }
  }

  console.error(`\nDone. ok=${ok} fail=${fail} outDir=${outDir}`);
  if (fail > 0) process.exit(2);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
