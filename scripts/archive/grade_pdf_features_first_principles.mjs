#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

function usage() {
  console.error('Usage: node scripts/grade_pdf_features_first_principles.mjs <featuresJsonl> <outJsonPath>');
  process.exit(1);
}

function readJsonl(file) {
  return fs
    .readFileSync(file, 'utf8')
    .split(/\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

function clean(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

function lc(s) {
  return clean(s).toLowerCase();
}

function isDefinitionish(r) {
  const n = lc(r.name);
  const q = lc(r.quote);
  if (/\bmeans\b/.test(q) && q.length < 260) return true;
  if (/\bmeans\b/.test(n)) return true;
  if (/(definition|means)/.test(n) && !/(waiting|covered|excluded|limit|restore|benefit|deduction|co-?pay|deductible|sub-?limit)/.test(n)) return true;
  return false;
}

function isOptional(r) {
  const t = `${lc(r.name)}\n${lc(r.quote)}\n${lc(r.reference)}`;
  return /(optional|add-?on|if\s+opted|on\s+availing\s+this\s+option|can\s+be\s+opted)/i.test(t);
}

function extractMaxInt(text) {
  const ms = String(text).match(/\b\d{1,4}\b/g);
  if (!ms) return null;
  return ms.map(Number).reduce((a, b) => (Number.isFinite(b) && b > a ? b : a), -Infinity);
}

function pickBest(cands, prefer = []) {
  if (!cands.length) return null;
  const scored = cands.map((r) => {
    const text = `${r.name}\n${r.quote}\n${r.reference}`;
    let score = 0;
    for (let i = 0; i < prefer.length; i++) {
      if (prefer[i].test(text)) score += (prefer.length - i) * 10;
    }
    if (r.reference) score += 2;
    score += Math.min(6, Math.floor((r.quote?.length ?? 0) / 180));
    // optional is slightly lower priority for core picks
    if (isOptional(r)) score -= 2;
    return { r, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].r;
}

function outItem(r, explanation) {
  const name = (isOptional(r) ? 'Optional: ' : '') + clean(r.name);
  return {
    name,
    quote: clean(r.quote),
    reference: r.reference ? clean(r.reference) : 'Not provided',
    explanation,
  };
}

function expl(what, when) {
  return `What this means for you: ${what} When it applies: ${when}`;
}

function build(features) {
  const items = [];
  const seen = new Set();
  for (const r of features) {
    const rec = {
      clause_id: Number(r.clause_id),
      page: r.page,
      type: r.type,
      name: clean(r.name),
      quote: clean(r.quote),
      reference: r.reference ?? null,
      notes: r.notes,
    };
    if (!rec.name || !rec.quote) continue;
    if (isDefinitionish(rec)) continue; // per spec
    const k = `${rec.type}||${rec.name}||${rec.quote}`;
    if (seen.has(k)) continue;
    seen.add(k);
    items.push(rec);
  }

  const GREAT = [];
  const GOOD = [];
  const BAD = [];
  const UNCLEAR = [];

  const add = (bucket, r, explanation) => {
    if (!r) return;
    const it = outItem(r, explanation);
    const q = it.quote;
    // do not duplicate exact quotes across buckets
    const all = [...GREAT, ...GOOD, ...BAD, ...UNCLEAR];
    if (all.some((x) => x.quote === q)) return;
    bucket.push(it);
  };

  // -----------------
  // CORE (big rocks)
  // -----------------

  // Waiting periods
  const initialWaiting = pickBest(items.filter(r => /within\s+30\s+days/.test(lc(r.quote)) && /excluded/.test(lc(r.quote))), [/within\s+30\s+days/i, /except\s+claims\s+arising\s+due\s+to\s+an\s+accident/i]);
  if (initialWaiting) {
    add(GOOD, initialWaiting, expl('Hospitalizations for illness are not covered in the first 30 days (accidents are usually treated differently).', 'During the first 30 days from the policy start date.'));
  }

  const pedWaiting = pickBest(items.filter(r => /pre\s*-?\s*existing/.test(lc(r.quote)) && /(\b36\b\s*months|36\s*months)/.test(lc(r.quote)) && /excluded/.test(lc(r.quote))), [/code\s*–\s*excl01/i, /36\s*months/i, /pre\s*-?\s*existing/i]);
  if (pedWaiting) {
    add(GOOD, pedWaiting, expl('Pre-existing diseases are covered only after the waiting period is completed.', 'For claims related to pre-existing conditions.'));
  }

  const specificIllness = pickBest(items.filter(r => /listed\s+conditions|specified\s+disease|procedure/.test(lc(r.quote)) && /24\s*months/.test(lc(r.quote)) && /excluded/.test(lc(r.quote))), [/24\s*months/i]);
  if (specificIllness) {
    add(GOOD, specificIllness, expl('Certain listed illnesses/procedures are covered only after the specific waiting period.', 'For those listed conditions/procedures until the waiting period completes.'));
  }

  // Room rent & payout mechanics
  const roomActuals = pickBest(
    items.filter(r => /room\s*rent/i.test(r.quote) && /at\s+actuals/i.test(r.quote)),
    [/1\.1\.a/i, /room\s*rent/i, /at\s+actuals/i]
  );
  if (roomActuals) {
    add(GREAT, roomActuals, expl('Room rent is covered at actuals (no daily cap stated in the default term we found).', 'For hospitalization room charges as per the policy.'));
  }

  // Proportionate deduction is claim-shock only if room rent is actually capped/eligibility-limited.
  const propDed = pickBest(items.filter(r => /proportionate\s+deduction/.test(lc(r.quote)) && !/not\s+(be\s+)?applicable/.test(lc(r.quote))), [/proportionate\s+deduction/i, /room/i]);
  if (propDed && !roomActuals) {
    add(BAD, propDed, expl('Choosing a higher room category can reduce payouts across associated medical expenses (not just room rent).', 'If you choose a room category above your eligibility.'));
  }

  // Pre / Post hospitalization windows
  const preHospCand = items.filter(r => /pre\s*-\s*hospitalization/.test(lc(r.quote)) && /\b(\d{1,3})\b/.test(lc(r.quote)) && !/modification/.test(lc(r.name)));
  const preHosp = pickBest(preHospCand, [/annexure/i, /pre\s*-\s*hospitalization/i]);
  if (preHosp) {
    const days = extractMaxInt(preHosp.quote);
    const bucket = days != null ? (days >= 60 ? GREAT : (days >= 30 ? GOOD : BAD)) : GOOD;
    add(bucket, preHosp,
      days != null && days >= 60
        ? expl('Pre-hospitalization expenses are covered for a relatively long window.', 'For expenses incurred before hospitalization as per the policy window.')
        : expl('Pre-hospitalization expenses are covered, but for a shorter window.', 'For expenses incurred before hospitalization as per the policy window.')
    );
  }

  const postHosp180 = pickBest(items.filter(r => /post\s*-\s*hospitalization/.test(lc(r.quote)) && /\b180\b/.test(lc(r.quote))), [/post\s*-\s*hospitalization/i, /180/i]);
  if (postHosp180) {
    add(GREAT, postHosp180, expl('Post-hospitalization expenses are covered for a relatively long window.', 'For expenses incurred after discharge as per the policy window.'));
  }

  // Consumables / non-medical
  const nonMed = pickBest(items.filter(r => /non-?medical\s+expenses/.test(lc(r.quote)) || /annexure\s+b/.test(lc(r.quote))), [/non-?medical\s+expenses/i, /annexure\s+b/i, /indemnify/i]);
  if (nonMed) {
    add(GREAT, nonMed, expl('Non-medical/consumable type expenses listed in the policy are covered under this benefit.', 'When those listed non-medical items are part of an admissible claim.'));
  }

  // Restore / multipliers — separate items
  const secure = pickBest(items.filter(r => /secure\s+benefit/.test(lc(r.name)) || /secure\s+benefit/.test(lc(r.quote))), [/additional\s+amount/i, /secure\s+benefit/i]);
  if (secure) add(GREAT, secure, expl('You get an additional amount of cover available under Secure Benefit.', 'When claims are admissible under the covered sections.'));

  const plus = pickBest(items.filter(r => /plus\s+benefit/.test(lc(r.name)) || /plus\s+benefit/.test(lc(r.quote))), [/50%/i, /added/i, /renew/i]);
  if (plus) add(GREAT, plus, expl('Your available cover increases on renewal via Plus Benefit.', 'On renewal as per policy terms.'));

  const restore = pickBest(items.filter(r => /restore/.test(lc(r.name)) || /restore\s+benefit/.test(lc(r.quote)) || /instantly\s+add\s+100%/.test(lc(r.quote))), [/instantly\s+add/i, /100%/i, /restore/i]);
  if (restore) add(GREAT, restore, expl('Your cover can be restored within the policy year after an admissible claim.', 'After an admissible claim during the policy year.'));

  // Co-pay (only if a real rule exists; ignore pure definition)
  const copayRule = pickBest(items.filter(r => /co-?pay/.test(lc(r.quote)) && /(applicable|shall|deducted|borne)/.test(lc(r.quote)) && !/means/.test(lc(r.quote))), [/co-?pay/i]);
  if (copayRule) {
    add(GOOD, copayRule, expl('A co-pay may apply as per the clause.', 'When the co-pay condition is triggered.'));
  } else {
    // Per your rule: co-pay impacts out-of-pocket; if we cannot confirm it, mark as UNCLEAR.
    UNCLEAR.push({
      name: 'Co-pay not clearly found in extracted wording',
      quote: '',
      reference: 'Not provided',
      explanation: expl('We could not confidently find a mandatory co-pay clause in the extracted text we’re using.', 'If a co-pay exists, it can increase your out-of-pocket cost on every claim.'),
    });
  }

  // Deductible (same logic: if missing, mark UNCLEAR)
  const deductibleRule = pickBest(items.filter(r => /deductible/.test(lc(r.quote)) && /(applicable|shall|borne)/.test(lc(r.quote)) && !/means/.test(lc(r.quote))), [/aggregate\s+deductible/i, /deductible/i]);
  if (deductibleRule) {
    add(GOOD, deductibleRule, expl('A deductible may apply as per the clause.', 'When the deductible condition is triggered.'));
  } else {
    UNCLEAR.push({
      name: 'Deductible not clearly found in extracted wording',
      quote: '',
      reference: 'Not provided',
      explanation: expl('We could not confidently find a deductible clause in the extracted text we’re using.', 'If a deductible exists, you may need to pay part of the claim before the policy pays.'),
    });
  }

  // Disease sublimits (BAD if a real cap is present)
  const diseaseSublimit = pickBest(
    items.filter(r =>
      /(cataract|hernia|knee|procedure|dialysis|chemotherapy|radiotherapy|angioplasty|stent|tonsil|gallbladder)/i.test(r.quote) &&
      /(sub-?limit|sublimit|limited\s+to|up\s+to|maximum)/i.test(r.quote) &&
      /(₹|\b(?:rs\.?|inr)\b|\b\d{2,}\b)/i.test(r.quote)
    ),
    [/cataract/i, /sub-?limit/i, /limited\s+to|up\s+to|maximum/i]
  );
  if (diseaseSublimit) add(BAD, diseaseSublimit, expl('A disease/procedure-specific cap can materially limit payouts for common treatments.', 'For the specified disease/procedure.'));

  // Air ambulance / domiciliary / bariatric (only if explicit coverage clause exists)
  const airAmb = pickBest(items.filter(r => /air\s+ambulance/.test(lc(r.name)) || /air\s+ambulance/.test(lc(r.quote))), [/air\s+ambulance/i]);
  if (airAmb) add(GREAT, airAmb, expl('Air ambulance is covered as per the clause.', 'When the air ambulance benefit conditions are met.'));

  const dom = pickBest(items.filter(r => /domiciliary\s+hospitalization/.test(lc(r.name)) || /domiciliary\s+hospitalization/.test(lc(r.quote))), [/domiciliary/i]);
  if (dom && /(shall\s+indemnify|covered|indemnify)/i.test(dom.quote)) {
    add(GREAT, dom, expl('Domiciliary hospitalization is covered when treatment is taken at home under allowed circumstances.', 'When the domiciliary conditions in the clause are met.'));
  }

  const bari = pickBest(items.filter(r => /bariatric/.test(lc(r.name)) || /bariatric/.test(lc(r.quote))), [/bariatric/i]);
  if (bari) add(GREAT, bari, expl('Bariatric surgery is covered as per the clause.', 'When the bariatric benefit conditions are met.'));

  // Cashless network size is usually not in policy wording; only include if a number is stated.
  const cashless = pickBest(items.filter(r => /(network\s+hospitals|cashless)/i.test(r.quote) && /\b\d{4,}\b/.test(r.quote)), [/cashless/i, /network/i]);
  if (cashless) {
    const n = extractMaxInt(cashless.quote);
    add(n && n >= 10000 ? GREAT : (n && n >= 7000 ? GOOD : BAD), cashless, expl('Cashless network size is mentioned in the policy wording.', 'When you use network hospitals for cashless claims.'));
  }

  // -----------------
  // NICE-TO-HAVES (fillers, still bucketed)
  // -----------------
  const niceGreat = items.filter(r => /(second\s+opinion|e\s*-?opinion|health\s+check|preventive|daily\s+cash|wellness)/i.test(`${r.name}\n${r.quote}`));
  for (const r of niceGreat.slice(0, 20)) {
    if (GREAT.length >= 8) break;
    // Keep these mostly in GOOD unless clearly strong.
    add(GOOD, r, expl('This is an extra benefit that can be useful but is not a core payout driver.', 'When the benefit conditions are met.'));
  }

  // Enforce caps in ordering: Core (already added first) then nice-to-haves.
  const cap = (arr) => arr;

  return {
    GREAT: cap(GREAT),
    GOOD: cap(GOOD),
    BAD: cap(BAD),
    UNCLEAR: cap(UNCLEAR),
    disclaimer: "Disclaimer: This analysis is for informational purposes only and does not constitute financial or insurance advice. Always read your policy documents carefully and consult with a licensed insurance advisor for specific guidance.",
  };
}

async function main() {
  const [inPath, outPath] = process.argv.slice(2);
  if (!inPath || !outPath) usage();
  await fsp.mkdir(path.dirname(outPath), { recursive: true });

  const raw = readJsonl(inPath);
  const out = build(raw);
  await fsp.writeFile(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.error(`Wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
