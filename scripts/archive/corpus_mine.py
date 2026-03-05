import re
import json
from pathlib import Path
from collections import Counter, defaultdict
from pypdf import PdfReader

PDF_ROOT = Path('policy-wording')
OUT_DIR = Path('docs/corpus-mining')
OUT_DIR.mkdir(parents=True, exist_ok=True)

pdfs = sorted(list(PDF_ROOT.rglob('*.pdf')) + list(PDF_ROOT.rglob('*.PDF')))

# phrase patterns to track
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

pat_compiled = [re.compile(p, re.I) for p in PHRASE_PATTERNS]

# token-ish phrase mining (simple): extract normalized 3-6 word ngrams from heading-like lines

def norm(s: str) -> str:
    s = s.lower()
    s = re.sub(r'[^a-z0-9%₹ ]+', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def extract_text(reader, max_pages=20):
    pages = []
    for i in range(min(max_pages, len(reader.pages))):
        try:
            t = reader.pages[i].extract_text() or ''
        except Exception:
            t = ''
        pages.append(t)
    return "\n".join(pages)


def ngrams(words, n):
    for i in range(len(words)-n+1):
        yield ' '.join(words[i:i+n])


per_pdf_phrases = {}
phrase_freq = Counter()

# For uniqueness, store which PDFs contain which phrase keys
phrase_to_pdfs = defaultdict(set)

for pdf in pdfs:
    insurer = pdf.parent.name
    key = str(pdf.as_posix())
    try:
        reader = PdfReader(str(pdf))
    except Exception:
        continue

    text = extract_text(reader, max_pages=25)
    low = text.lower()

    found = set()
    for rx in pat_compiled:
        if rx.search(low):
            found.add(rx.pattern)

    # Lightweight ngram mining from first pages
    words = norm(text).split()
    # keep only a subset to reduce noise
    grams = set()
    for n in (3,4,5):
        for g in ngrams(words, n):
            if any(tok in g for tok in ('policy', 'section', 'definition', 'insured', 'company')):
                continue
            if len(g) < 10:
                continue
            grams.add(g)

    # keep top grams by internal repeats within this doc sample
    gram_counts = Counter(grams)
    # (grams are set so counts are 1; skip)

    per_pdf_phrases[key] = {
        'insurer': insurer,
        'pattern_hits': sorted(list(found)),
    }

    for p in found:
        phrase_freq[p] += 1
        phrase_to_pdfs[p].add(key)

# Unique candidates: phrases that appear in <=2 PDFs
unique_patterns = [p for p,c in phrase_freq.items() if c <= 2]

report = {
    'total_pdfs': len(pdfs),
    'pattern_frequency': phrase_freq.most_common(),
    'unique_patterns': unique_patterns,
    'per_pdf': per_pdf_phrases,
}

(OUT_DIR / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')

# Markdown summary
lines = []
lines.append('# Corpus Mining Report')
lines.append('')
lines.append(f'Total PDFs scanned: **{len(pdfs)}**')
lines.append('')
lines.append('## Phrase pattern frequency (how many PDFs contain the phrase)')
lines.append('')
for p,c in phrase_freq.most_common():
    lines.append(f'- **{c}** — `{p}`')
lines.append('')
lines.append('## Unique / rare patterns (appear in 1–2 PDFs)')
lines.append('')
for p in sorted(unique_patterns):
    lines.append(f'- `{p}` — seen in {phrase_freq[p]} PDF(s)')
lines.append('')
lines.append('## Per-PDF pattern hits (first 25 pages)')
lines.append('')
for k in sorted(per_pdf_phrases.keys()):
    hits = per_pdf_phrases[k]['pattern_hits']
    lines.append(f'### {k}')
    if hits:
        for h in hits:
            lines.append(f'- `{h}`')
    else:
        lines.append('- (no pattern hits)')
    lines.append('')

(OUT_DIR / 'report.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
print('Wrote', OUT_DIR / 'report.md')
