import sys
from pathlib import Path
from pypdf import PdfReader

pdf_path = Path(sys.argv[1])
reader = PdfReader(str(pdf_path))

out = []
for i, page in enumerate(reader.pages):
    try:
        txt = page.extract_text() or ""
    except Exception:
        txt = ""
    out.append(txt)

print("\n\n".join(out))
