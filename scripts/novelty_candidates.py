import re
import json
from pathlib import Path
from collections import defaultdict
from pypdf import PdfReader

ROOT = Path('policy-wording')
OUT_MD = Path('docs/corpus-mining/novelty-candidates.md')
OUT_JSON = Path('docs/corpus-mining/novelty-candidates.json')
OUT_MD.parent.mkdir(parents=True, exist_ok=True)

# Reuse the same patterns as corpus_mine (keep in sync)
PHRASE_PATTERNS = [
    r'maximum liability shall not exceed',
    r'once per policy year',
    r'sub[- ]limit',
    r'co-?pay(?:ment)?',
    r'deductible',
    r'proportionate deduction',
    r'room rent',
    r'pre[- ]existing',
    r'waiting period',
    r'restore|recharge|reload|refill|reinstat',
    r'non[- ]medical',
    r'consumable',
    r'day care',
    r'domiciliary',
    r'ayush',
    r'organ donor',
    r'air ambulance',
    r'2x|two times|twice|double',
    r'unlimited',
]

compiled = [(p, re.compile(p, re.I)) for p in PHRASE_PATTERNS]

def clean_ws(s: str) -> str:
    return re.sub(r'\s+', ' ', s).strip()


def extract_pages(reader, max_pages=35):
    pages = []
    for i in range(min(max_pages, len(reader.pages))):
        try:
            t = reader.pages[i].extract_text() or ''
        except Exception:
            t = ''
        pages.append(clean_ws(t))
    return pages


def snippet_around(text: str, start: int, end: int, pad: int = 140) -> str:
    s = max(0, start - pad)
    e = min(len(text), end + pad)
    return text[s:e]

# Build document frequency for each pattern
pdfs = sorted(list(ROOT.rglob('*.pdf')) + list(ROOT.rglob('*.PDF')))
pattern_df = defaultdict(int)

# First pass: DF
for pdf in pdfs:
    try:
        r = PdfReader(str(pdf))
    except Exception:
        continue
    pages = extract_pages(r, max_pages=25)
    joined = ' '.join(pages)
    low = joined.lower()
    seen = set()
    for pname, rx in compiled:
        if rx.search(low):
            seen.add(pname)
    for pname in seen:
        pattern_df[pname] += 1

# Second pass: candidates with snippets, focus on rare-ish patterns
# Define rarity tiers

def rarity_label(df: int) -> str:
    if df <= 2:
        return 'rare'
    if df <= 8:
        return 'uncommon'
    return 'common'

out = {}
md = []
md.append('# Novelty Candidates (pattern-based)')
md.append('')
md.append('This report lists evidence snippets around key clause patterns. “Rare/uncommon” patterns are good candidates for special features.')
md.append('')

for pdf in pdfs:
    key = str(pdf.as_posix())
    insurer = pdf.parent.name
    try:
        r = PdfReader(str(pdf))
    except Exception:
        continue
    pages = extract_pages(r, max_pages=35)

    hits = []
    for pi, page_text in enumerate(pages):
        if not page_text:
            continue
        for pname, rx in compiled:
            m = rx.search(page_text)
            if not m:
                continue
            df = pattern_df[pname]
            hits.append({
                'pattern': pname,
                'rarity': rarity_label(df),
                'df': df,
                'page': pi + 1,
                'snippet': snippet_around(page_text, m.start(), m.end()),
            })

    # sort: rare first, then by pattern
    hits.sort(key=lambda x: (0 if x['rarity']=='rare' else 1 if x['rarity']=='uncommon' else 2, x['pattern']))
    # keep top 25 per PDF to avoid huge file
    hits = hits[:25]

    out[key] = {
        'insurer': insurer,
        'hits': hits,
    }

    # Markdown
    md.append(f'## {key}')
    md.append('')
    if not hits:
        md.append('- (no hits in first 35 pages)')
        md.append('')
        continue
    for h in hits:
        md.append(f"- **{h['rarity']}** (df={h['df']}) — `{h['pattern']}` — page {h['page']}")
        md.append(f"  - snippet: {h['snippet']}")
    md.append('')

OUT_JSON.write_text(json.dumps({
    'total_pdfs': len(pdfs),
    'pattern_df': dict(pattern_df),
    'per_pdf': out,
}, indent=2), encoding='utf-8')
OUT_MD.write_text('\n'.join(md) + '\n', encoding='utf-8')

print('Wrote', OUT_MD)
