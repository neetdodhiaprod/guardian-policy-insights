#!/usr/bin/env node
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

const mergedPath = process.argv[2] ?? 'dist/features/all_features_merged.jsonl';
const outDir = process.argv[3] ?? 'dist/features/dedupe_strict';
const intervalMs = Number(process.env.AUTODEDUPE_INTERVAL_MS ?? 180000);

function runDedupe() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/features_dedupe_strict.mjs', mergedPath, outDir], {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    child.on('exit', code => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`dedupe failed (${code})`));
    });
  });
}

async function main() {
  console.error(`[autodedupe] watching ${mergedPath} every ${Math.round(intervalMs / 1000)}s`);

  let lastMtime = 0;
  try {
    lastMtime = (await fs.stat(mergedPath)).mtimeMs;
  } catch {
    console.error(`[autodedupe] merged file not found yet: ${mergedPath}`);
  }

  // Attempt first run (will fail if merged missing).
  try {
    await runDedupe();
  } catch (e) {
    console.error(String(e));
  }

  while (true) {
    await new Promise(r => setTimeout(r, intervalMs));
    try {
      const st = await fs.stat(mergedPath);
      if (st.mtimeMs > lastMtime) {
        console.error(`[autodedupe] change detected, re-running strict dedupe`);
        await runDedupe();
        lastMtime = st.mtimeMs;
      }
    } catch (e) {
      console.error(String(e));
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
