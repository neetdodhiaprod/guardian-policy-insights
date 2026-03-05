# Guardian One — Insurance Policy Analyzer

> **Prototype / Proof of Concept** — Built by Product for handoff to the dev team. This is a specification and working demo that should guide production-level implementation decisions.

## What Is This?

A web app that helps Indian consumers understand their health insurance policy in plain English — categorized as **Best-in-class**, **Good**, **Red Flags**, or **Needs Clarification**.

**103 policies pre-analysed** across 6 major insurers (Aditya Birla, Care, HDFC ERGO, ICICI Lombard, Niva Bupa, Star Health). Each policy is broken down into ~15 features with plain-English explanations and direct quotes from the policy wording.

Users can browse the library or upload their own PDF — the app identifies which policy it is and shows the pre-built analysis instantly.

---

## How It Works (User Flow)

**Path 1 — Browse the library:**
```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Select Insurer  │ ──▶ │  Select Policy   │ ──▶ │ View Results │
│  (6 insurers)    │     │  (search + list) │     │  (instant)   │
└──────────────────┘     └──────────────────┘     └──────────────┘
```

**Path 2 — Upload your PDF:**
```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Upload PDF  │ ──▶ │ Extract Text │ ──▶ │ Identify Policy  │ ──▶ │ View Results │
│  (client)    │     │ (client,     │     │ (server, text    │     │  (instant)   │
│              │     │  pdf.js)     │     │  matching)       │     │              │
└──────────────┘     └──────────────┘     └──────────────────┘     └──────────────┘
```

1. **Select or Upload** — Pick from the library, or drop a PDF. Client validates file type + size.
2. **Extract** — `pdfjs-dist` extracts text client-side. Checks for password protection and non-insurance documents.
3. **Identify** — Extracted text is sent to `POST /api/policies/identify`. The server matches the insurer by keyword patterns, then scores each known policy in that insurer's library by text similarity.
4. **Results** — The matching pre-built analysis is returned and rendered as collapsible feature cards with policy quotes, explanations, and section references.

---

## Project Structure

```
├── out/                               # 103 pre-analysed policy JSONs — the core dataset
│   ├── aditya-birla/                  #   16 policies
│   ├── care/                          #   17 policies
│   ├── hdfc-ergo/                     #   17 policies
│   ├── icici-lombard/                 #   10 policies
│   ├── niva-bupa/                     #   18 policies
│   └── star-health-care/              #   25 policies
│
├── server/
│   ├── index.ts                       # Express entry point (port 3001)
│   └── routes/
│       ├── policies.ts                # MAIN: GET /api/policies, GET /api/policies/:ins/:id, POST /api/policies/identify
│       ├── analyze.ts                 # /api/analyze — live OpenAI analysis (not wired to UI yet)
│       ├── features.ts                # /api/features — dev explorer
│       ├── graded.ts                  # /api/graded — dev explorer
│       ├── out.ts                     # /api/out — dev explorer
│       └── admin.ts                   # /api/admin — variant editor (not wired to DB)
│
├── src/
│   ├── App.tsx                        # Root — providers, routing
│   ├── pages/
│   │   ├── Index.tsx                  # Main page — insurer grid → policy selector → results
│   │   ├── PoliciesBrowser.tsx        # Dev tool: browse all 103 policies as cards
│   │   ├── FeaturesExplorer.tsx       # Dev tool: explore all features across all policies
│   │   ├── GradedExplorer.tsx         # Dev tool: filter features by grade
│   │   ├── OutBrowser.tsx             # Dev tool: raw JSON browser for out/ files
│   │   └── admin/                     # Admin pages (bearer token protected)
│   ├── components/
│   │   ├── Header.tsx                 # Top nav bar with logo
│   │   ├── HeroSection.tsx            # Hero container/wrapper
│   │   ├── ResultsSection.tsx         # Results view — summary counts + feature sections
│   │   ├── FeatureSection.tsx         # Collapsible section per category (great/good/bad/unclear)
│   │   └── Footer.tsx                 # Page footer with disclaimer
│   ├── utils/
│   │   └── pdfExtractor.ts            # PDF text extraction + document validation (client-side)
│   └── lib/
│       ├── mockData.ts                # TypeScript types: PolicyAnalysis, PolicyFeature
│       └── utils.ts                   # Tailwind merge utility
│
├── scripts/
│   ├── regrade_all.mjs                # Re-grade all policies via OpenAI gpt-4.1-mini (offline)
│   ├── fix_copay.mjs                  # Post-processor: enforce co-pay → Red Flag rule
│   ├── clean_feature_names.mjs        # Algorithmic feature name cleanup
│   ├── verify_outputs.mjs             # Validate all out/ JSONs for schema correctness
│   ├── spot_check.mjs                 # Manually verify a single policy's grading
│   ├── qa_identify.mjs                # 70-test suite for policy identification accuracy
│   └── archive/                       # One-time data processing scripts (historical)
│
└── HANDOVER.md                        # Detailed architecture, data model, and production gaps
```

---

## Key Technical Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Analysis approach | Pre-baked JSONs in `out/` | Instant results (< 100ms); no per-request AI cost; consistent quality |
| PDF identification | Server-side text matching | Insurer pattern + policy name scoring; works for all 103 known policies |
| PDF parsing | Client-side (`pdfjs-dist`) | No server load for extraction; instant client-side feedback on bad files |
| AI grading pipeline | OpenAI `gpt-4.1-mini` (offline) | Best cost/accuracy for structured JSON; run once, not at request time |
| Backend | Express.js + `tsx watch` | Simple, no framework overhead; all routes serve static JSON from `out/` |
| State management | Local React state (`useState`) | Single-page flow, no cross-route state needed |
| Styling | Tailwind CSS + shadcn/ui + semantic tokens | Consistent design system, easy theming |

---

## The Grading Rubric (Important for Production)

The rubric lives in `scripts/regrade_all.mjs` and encodes **domain expertise** for Indian health insurance. Key rules:

| Feature | Best-in-class | Good | Red Flag |
|---------|--------------|------|----------|
| **Room Rent** | At Actuals / No limit | Single Private AC room | Any rupee cap or % cap |
| **PED Waiting** | < 24 months | 24–48 months | > 48 months |
| **Co-pay** | Zero mention in document | — | ANY mention (optional, age-based, PPN, etc.) |
| **Post-hospitalisation** | > 180 days | 60–180 days | < 60 days |
| **Restore Benefit** | Covers same illness | Different illness only | No restore |
| **Consumables** | Fully covered | — | Excluded |

> ⚠️ **For production:** The co-pay rule is an absolute override — even "optional" co-pay is flagged Red. After every regrade run, also run `scripts/fix_copay.mjs` to enforce this deterministically (the AI occasionally misclassifies it).

---

## API Contract

### `GET /api/policies`
Returns all insurers and their policies (summary counts only, no feature detail).

```json
{
  "insurers": [{
    "id": "hdfc-ergo",
    "label": "HDFC ERGO",
    "policies": [{
      "id": "Optima_Secure",
      "policyName": "Optima Secure",
      "policyType": "Individual | Family Floater",
      "summary": { "great": 5, "good": 8, "bad": 3, "unclear": 1 }
    }]
  }]
}
```

### `GET /api/policies/:insurer/:policy`
Returns the full analysis for a single policy (all features with quotes and explanations).

### `POST /api/policies/identify`

**Request:** `{ "text": "string — first ~20,000 chars of extracted PDF text" }`

**Response (matched):**
```json
{
  "matched": true,
  "insurerId": "hdfc-ergo",
  "policyId": "Optima_Secure",
  "data": { ...full policy JSON... }
}
```

**Response (not matched):**
```json
{
  "matched": false,
  "reason": "Insurer not recognised. We currently support Aditya Birla, Care, HDFC ERGO, ICICI Lombard, Niva Bupa, and Star Health."
}
```

**Error responses:**

| Status | Body | When |
|--------|------|------|
| 200 `matched: false` | `{ "reason": "Document too short..." }` | < 500 chars extracted |
| 200 `matched: false` | `{ "reason": "This appears to be a life insurance document..." }` | Non-health doc detected |
| 200 `matched: false` | `{ "reason": "Insurer not recognised..." }` | Supported insurer not found |

---

## Policy JSON Schema

Each file in `out/<insurer>/<Policy_Name>.json` follows this shape:

```json
{
  "policyName": "Optima Secure",
  "insurer": "HDFC ERGO",
  "sumInsured": "₹5L – ₹2Cr",
  "policyType": "Individual | Family Floater",
  "documentType": "Policy Wording",
  "summary": { "great": 5, "good": 8, "bad": 3, "unclear": 1 },
  "features": {
    "great": [{ "name": "Room Rent", "quote": "...", "reference": "Section 3.2", "explanation": "..." }],
    "good": [...],
    "bad": [...],
    "unclear": [...]
  },
  "disclaimer": "This analysis is for informational purposes only..."
}
```

---

## Environment & Secrets

| Variable | Where | Purpose |
|----------|-------|---------|
| `OPENAI_API_KEY` | `.env` | Used by `scripts/regrade_all.mjs` — **not needed at runtime** |
| `API_PORT` | `.env` | Express backend port (default: `3001`) |
| `ADMIN_TOKEN` | `.env` | Bearer token for `/api/admin` routes |
| `VITE_API_URL` | `.env` | Frontend → backend URL (default: `http://localhost:3001`) |

---

## Local Development

```bash
# Prerequisites: Node.js 20+ (via nvm)

git clone https://github.com/neetdodhiaprod/guardian-policy-insights.git
cd guardian-policy-insights

npm install

# Start both frontend (port 5173) + backend (port 3001):
npm run dev:all

# Or separately:
npm run dev      # Vite frontend only
npm run dev:api  # Express backend only
```

> **Note:** No API keys needed to run the app — all 103 analyses are pre-built in `out/`. The `OPENAI_API_KEY` is only needed if you want to re-run the grading pipeline.

---

## Known Limitations & TODOs

- [ ] **PDF upload is "best guess"** — identification only works for the 103 known policies; unknown policies return "not matched"
- [ ] **No live AI analysis** — `/api/analyze` (live OpenAI route) exists but is not wired to the UI
- [ ] **No database** — all data is static JSON files checked into the repo; no admin UI to update individual feature gradings
- [ ] **Data staleness** — policy wordings change; analyses reflect PDFs from early 2025
- [ ] **No auth** — no user authentication; analyses are not stored per user
- [ ] **Nav links** — Header nav links are placeholder `#` links
- [ ] **Admin pages** — `/admin` routes are scaffolded but not connected to any database
- [ ] **No mobile menu** — nav is hidden on mobile (`hidden md:flex`)

---

## For the Dev Team

1. **The data IS the product** — The 103 pre-analysed policies in `out/` are the core value. The UI is a thin layer on top. Protect and extend this dataset.
2. **The rubric IS the IP** — The grading logic in `scripts/regrade_all.mjs` encodes domain expertise. It should be version-controlled and refined based on user feedback. Every rule change requires a full re-grade run.
3. **Types are the contract** — `PolicyFeature` and `PolicyAnalysis` in `src/lib/mockData.ts` are the shared types between frontend and backend. Any schema change must be reflected in both the JSON files and the TypeScript types.
4. **Adding a new policy** — Drop the PDF in `policy-wording/<insurer>/`, run `node scripts/regrade_all.mjs <insurer>/<Policy>`, then `node scripts/fix_copay.mjs`. No server restart needed — the API reads files at request time.
5. **Design tokens** — All semantic colors (`great`, `good`, `bad`, `unclear`) are HSL tokens defined in `src/index.css`. Don't hardcode colors anywhere.
6. **See `HANDOVER.md`** — Full architecture walkthrough, production gaps, and explanation of every key decision.
