import csv
import os
from pathlib import Path
from datetime import datetime

from pypdf import PdfReader

ROOT = Path('policy-wording')
OUT_CSV = Path('docs/policy-wording/manifest.csv')
OUT_MD = Path('docs/policy-wording/index.md')

pdfs = sorted([p for p in ROOT.rglob('*.pdf')]) + sorted([p for p in ROOT.rglob('*.PDF')])

rows = []
for p in pdfs:
    insurer = p.parent.name
    try:
        reader = PdfReader(str(p))
        pages = len(reader.pages)
        # try to extract small sample to estimate text presence
        sample = ''
        for i in range(min(2, pages)):
            try:
                sample += (reader.pages[i].extract_text() or '')
            except Exception:
                pass
        sample = ' '.join(sample.split())
        has_text = bool(sample)
        sample = sample[:500]
    except Exception as e:
        pages = None
        has_text = False
        sample = f'ERROR: {type(e).__name__}: {e}'

    rows.append({
        'insurer': insurer,
        'file': str(p.as_posix()),
        'bytes': p.stat().st_size,
        'pages': pages,
        'has_extractable_text': has_text,
        'sample': sample,
    })

OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
with OUT_CSV.open('w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else ['insurer','file','bytes','pages','has_extractable_text','sample'])
    w.writeheader()
    for r in rows:
        w.writerow(r)

# Build a human index
by_insurer = {}
for r in rows:
    by_insurer.setdefault(r['insurer'], []).append(r)

now = datetime.utcnow().isoformat(timespec='seconds') + 'Z'
lines = []
lines.append('# Policy Wording PDFs — Index')
lines.append('')
lines.append(f'- Generated: `{now}`')
lines.append(f'- Total PDFs: **{len(rows)}**')
lines.append('')
lines.append('## By insurer')
lines.append('')
for insurer in sorted(by_insurer.keys()):
    items = by_insurer[insurer]
    total = len(items)
    text_ok = sum(1 for x in items if x['has_extractable_text'])
    lines.append(f'### {insurer} ({total} PDFs; {text_ok} with extractable text)')
    lines.append('')
    for x in sorted(items, key=lambda z: z['file']):
        size_mb = x['bytes'] / (1024*1024)
        pages = x['pages'] if x['pages'] is not None else '?' 
        lines.append(f"- `{x['file']}` — {pages} pages — {size_mb:.2f} MB — text: {'yes' if x['has_extractable_text'] else 'no'}")
    lines.append('')

OUT_MD.write_text('\n'.join(lines) + '\n', encoding='utf-8')
print(f"Scanned {len(rows)} PDFs → {OUT_CSV} and {OUT_MD}")
