import fs from 'fs';
import path from 'path';

let fixed = 0;

for (const insurer of fs.readdirSync('out').sort()) {
  const dir = path.join('out', insurer);
  if (!fs.statSync(dir).isDirectory()) continue;

  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.json')) continue;

    const fp = path.join(dir, file);
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    if (!data.features) continue;

    const f = data.features;
    const expected = {
      great:   f.great?.length   ?? 0,
      good:    f.good?.length    ?? 0,
      bad:     f.bad?.length     ?? 0,
      unclear: f.unclear?.length ?? 0,
    };
    const s = data.summary ?? {};

    if (s.great !== expected.great || s.good !== expected.good ||
        s.bad   !== expected.bad   || s.unclear !== expected.unclear) {
      console.log(`Fixed: ${insurer}/${file}`);
      console.log(`  was: ${JSON.stringify(s)}`);
      console.log(`  now: ${JSON.stringify(expected)}`);
      data.summary = expected;
      fs.writeFileSync(fp, JSON.stringify(data, null, 2));
      fixed++;
    }
  }
}

console.log(`\nTotal fixed: ${fixed}`);
