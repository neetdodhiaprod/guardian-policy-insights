#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

function usage() {
  console.error('Usage: node scripts/extract_clauses_pdfjs.mjs <pdfPath> <outJsonlPath>');
  process.exit(1);
}

function normSpace(s) {
  return s
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitParagraphs(pageText) {
  // Keep paragraph-like chunks; later we can do smarter clause splitting.
  const paras = pageText
    .split(/\n\s*\n+/)
    .map(p => normSpace(p))
    .filter(Boolean);
  return paras;
}

function isLikelyClauseStart(line) {
  return (
    /^\s*(Section|SECTION|Annexure|ANNEXURE)\b/.test(line) ||
    /^\s*Def\.\s*\d+\./.test(line) ||
    /^\s*[A-Z]\.[0-9]+/.test(line) ||
    /^\s*[A-Z]\.[0-9]+\.[0-9]+/.test(line) ||
    /^\s*\d+(?:\.\d+){1,}\b/.test(line) ||
    /^\s*\([a-z0-9ivx]+\)\s+/.test(line) ||
    /^\s*[•\-–]\s+/.test(line)
  );
}

function splitIntoClauses(paragraph) {
  // Heuristic: if paragraph contains multiple numbered sub-clauses or bullets, split on those lines.
  const lines = paragraph.split(/\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) return [paragraph];

  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    if (isLikelyClauseStart(lines[i])) starts.push(i);
  }
  if (starts.length <= 1) return [paragraph];

  const clauses = [];
  for (let s = 0; s < starts.length; s++) {
    const start = starts[s];
    const end = s + 1 < starts.length ? starts[s + 1] : lines.length;
    const chunk = lines.slice(start, end).join('\n').trim();
    if (chunk) clauses.push(chunk);
  }
  return clauses.length ? clauses : [paragraph];
}

function isBoilerplateLine(line) {
  const l = line.trim();
  if (!l) return true;

  // Common repeated header/footer fragments in these PDFs.
  if (/^HDFC\s+ERGO\b/i.test(l)) return true;
  if (/IRDAI\s+Reg\.?\s*No\.?/i.test(l)) return true;
  if (/\bCIN:\b/i.test(l)) return true;
  if (/Registered\s*&\s*Corporate\s*Office/i.test(l)) return true;
  if (/Leela\s+Business\s+Park/i.test(l)) return true;
  if (/Andheri\s*\(East\)/i.test(l)) return true;
  if (/Mumbai\s*[–-]?\s*400\s*059/i.test(l)) return true;
  if (/\bUIN:\b/i.test(l)) return true;
  if (/\bHDFHLIP\w*\b/i.test(l)) return true;

  // Standalone page numbers.
  if (/^\d{1,3}$/.test(l)) return true;

  return false;
}

async function extractPageText(doc, pageNum) {
  const page = await doc.getPage(pageNum);
  const content = await page.getTextContent();

  // pdf.js gives positioned items; we reconstruct lines by Y coordinate.
  const items = content.items
    .filter(it => typeof it.str === 'string')
    .map(it => ({
      str: it.str,
      x: it.transform?.[4] ?? 0,
      y: it.transform?.[5] ?? 0,
    }));

  const yTol = 2.0;
  const linesMap = new Map();
  for (const it of items) {
    const yKey = [...linesMap.keys()].find(k => Math.abs(k - it.y) <= yTol);
    const key = yKey ?? it.y;
    if (!linesMap.has(key)) linesMap.set(key, []);
    linesMap.get(key).push(it);
  }

  const sortedY = [...linesMap.keys()].sort((a, b) => b - a); // top to bottom
  const lines = [];
  for (const y of sortedY) {
    const lineItems = linesMap.get(y).sort((a, b) => a.x - b.x);
    const raw = lineItems.map(li => li.str).join(' ');
    const line = normSpace(raw);
    if (!isBoilerplateLine(line)) lines.push(line);
  }

  return normSpace(lines.join('\n'));
}

async function main() {
  const [pdfPath, outPath] = process.argv.slice(2);
  if (!pdfPath || !outPath) usage();

  await fs.mkdir(path.dirname(outPath), { recursive: true });

  const data = new Uint8Array(await fs.readFile(pdfPath));
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;

  const out = [];
  let clauseId = 0;

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const pageText = await extractPageText(doc, pageNum);
    if (!pageText) continue;

    const paras = splitParagraphs(pageText);
    for (const para of paras) {
      const clauses = splitIntoClauses(para);
      for (const clause of clauses) {
        clauseId += 1;
        out.push({
          clause_id: clauseId,
          pdf_path: pdfPath,
          page: pageNum,
          text: clause,
        });
      }
    }
  }

  const jsonl = out.map(r => JSON.stringify(r)).join('\n') + '\n';
  await fs.writeFile(outPath, jsonl, 'utf8');

  console.error(`Wrote ${out.length} clause records to ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
