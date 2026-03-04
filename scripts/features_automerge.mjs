#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const inDir = process.argv[2] ?? 'dist/features/features_raw';
const outJsonl = process.argv[3] ?? 'dist/features/all_features_merged.jsonl';
const outCsv = process.argv[4] ?? 'dist/features/all_features_summary.csv';
const intervalMs = Number(process.env.AUTOMERGE_INTERVAL_MS ?? 120000);

async function featureFileState() {
  const ents = await fs.readdir(inDir, { withFileTypes: true });
  const files = ents.filter(e => e.isFile() && e.name.endsWith('.features.jsonl'));
  let newest = 0;
  for (const f of files) {
    const st = await fs.stat(path.join(inDir, f.name));
    newest = Math.max(newest, st.mtimeMs);
  }
  return { count: files.length, newest };
}

function runMerge() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/features_merge.mjs', inDir, outJsonl, outCsv], {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    child.on('exit', code => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`merge failed (${code})`));
    });
  });
}

async function main() {
  console.error(`[automerge] watching ${inDir} every ${Math.round(intervalMs / 1000)}s`);
  let last = await featureFileState();
  console.error(`[automerge] initial: count=${last.count}`);

  // Always ensure merged outputs exist at start.
  await runMerge();

  while (true) {
    await new Promise(r => setTimeout(r, intervalMs));
    const cur = await featureFileState();
    if (cur.count !== last.count || cur.newest > last.newest) {
      console.error(`[automerge] change detected: count ${last.count} -> ${cur.count}`);
      try {
        await runMerge();
        last = cur;
      } catch (e) {
        console.error(String(e));
      }
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
