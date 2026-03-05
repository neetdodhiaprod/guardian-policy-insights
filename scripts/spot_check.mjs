import fs from 'fs';

function load(f) { return JSON.parse(fs.readFileSync(f)); }
function shortName(f) { return f.split('/').slice(-2).join('/'); }

// 1. Specific illness 24m in BAD
console.log('=== SPECIFIC ILLNESS IN BAD ===');
for (const f of [
  'out/aditya-birla/Activ_One_NXT.json',
  'out/aditya-birla/Activ_One_SAVR.json',
  'out/aditya-birla/Activ_One_VIP_Plus.json',
  'out/icici-lombard/Health_Shield_360.json',
]) {
  const d = load(f);
  const item = d.features.bad?.find(x => /specific|listed condition/i.test(x.name + x.explanation));
  if (item) console.log(shortName(f) + ':\n  ' + item.name + '\n  QUOTE: ' + item.quote.slice(0, 150) + '\n');
}

// 2. Single AC in GREAT
console.log('=== SINGLE AC IN GREAT ===');
for (const f of ['out/niva-bupa/Aspire_Titanium_Plus.json']) {
  const d = load(f);
  const item = d.features.great?.find(x => /room rent/i.test(x.name));
  if (item) console.log(shortName(f) + ':\n  ' + item.name + '\n  QUOTE: ' + item.quote.slice(0, 150) + '\n');
}

// 3. PED in BAD (genuine)
console.log('=== PED IN BAD ===');
for (const f of [
  'out/aditya-birla/Activ_Fit_Plus.json',
  'out/aditya-birla/Activ_One_SAVR.json',
]) {
  const d = load(f);
  const item = d.features.bad?.find(x => /pre.existing|ped waiting/i.test(x.name));
  if (item) console.log(shortName(f) + ':\n  ' + item.name + '\n  QUOTE: ' + item.quote.slice(0, 150) + '\n');
}

// 4. Proportionate + At-Actuals
console.log('=== PROPORTIONATE + AT-ACTUALS ===');
for (const f of [
  'out/hdfc-ergo/Optima_Secure_Global_Plus.json',
  'out/icici-lombard/Health_AdvantEdge.json',
  'out/niva-bupa/ReAssure_2_Bronze_Plus.json',
]) {
  const d = load(f);
  const rr = d.features.great?.find(x => /room rent/i.test(x.name) && !/proportionate/i.test(x.name));
  const prop = d.features.bad?.find(x => /proportionate/i.test(x.name));
  console.log(shortName(f) + ':');
  console.log('  GREAT room: ' + (rr ? rr.name : 'none'));
  console.log('  GREAT quote: ' + (rr ? rr.quote.slice(0, 100) : ''));
  console.log('  BAD prop: ' + (prop ? prop.name.slice(0, 100) : 'none') + '\n');
}

// 5. Room rent multiple categories
console.log('=== ROOM RENT MULTI-CAT ===');
for (const f of [
  'out/hdfc-ergo/Optima_Restore.json',
  'out/icici-lombard/Max_Protect_Classic.json',
  'out/care/Care_Care.json',
]) {
  const d = load(f);
  for (const cat of ['great', 'good', 'bad', 'unclear']) {
    for (const x of (d.features[cat] || [])) {
      if (/room rent/i.test(x.name) && !/proportionate|ratable|pro.rata/i.test(x.name)) {
        console.log(shortName(f) + ' [' + cat.toUpperCase() + ']: ' + x.name);
        console.log('  QUOTE: ' + x.quote.slice(0, 120));
      }
    }
  }
  console.log();
}
