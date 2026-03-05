# Guardian Policy Insights — Developer Handover

> **Status: Prototype.** This is a functional proof-of-concept built to validate the idea. The data pipeline and grading logic are production-ready; the app infrastructure needs significant work before going live.

---

## What It Does

A tool that helps Indian consumers understand their health insurance policy in plain English. Users either:
1. **Browse the library** — pick an insurer and a pre-analysed policy to see its features
2. **Upload a PDF** — the app extracts text, tries to identify the policy in the library, and shows the analysis

Each policy is broken down into ~15 features graded as:
- **Best-in-class** — genuinely better than market
- **Good** — acceptable / market standard
- **Red Flags** — worse than market or consumer-unfriendly
- **Needs Clarification** — ambiguous or policy-specific, needs to be checked

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + shadcn/ui (Radix UI) |
| Routing | React Router v6 |
| Data fetching | TanStack React Query |
| Backend | Express.js (Node 20) served via `tsx watch` |
| PDF parsing | pdfjs-dist (client-side, in-browser) |
| AI grading | OpenAI `gpt-4.1-mini` (offline pipeline only) |
| Database | **None.** All data is static JSON files in `out/` |

---

## Directory Structure

```
guardian-policy-insights/
├── out/                        ← 103 pre-analysed policy JSONs (the core dataset)
│   ├── aditya-birla/           ← 16 policies
│   ├── care/                   ← 17 policies
│   ├── hdfc-ergo/              ← 17 policies
│   ├── icici-lombard/          ← 10 policies
│   ├── niva-bupa/              ← 18 policies
│   └── star-health-care/       ← 25 policies
├── policy-wording/             ← source PDFs (same folder structure as out/)
├── server/
│   ├── index.ts                ← Express entry point (port 3001)
│   ├── config.ts               ← env var loader
│   ├── middleware/adminAuth.ts ← bearer token check for /api/admin
│   └── routes/
│       ├── policies.ts         ← MAIN: /api/policies + /api/policies/identify
│       ├── analyze.ts          ← /api/analyze (live OpenAI analysis — not used in UI yet)
│       ├── features.ts         ← /api/features (dev explorer)
│       ├── graded.ts           ← /api/graded (dev explorer)
│       ├── out.ts              ← /api/out (dev explorer)
│       └── admin.ts            ← /api/admin (variant editor — not wired to DB)
├── src/
│   ├── App.tsx                 ← Routes (main: /, dev tools: /features /graded /out /policies)
│   ├── pages/
│   │   ├── Index.tsx           ← Main user-facing page (all UX logic lives here)
│   │   ├── PoliciesBrowser.tsx ← Dev tool: browse all 103 policies as cards
│   │   ├── FeaturesExplorer.tsx← Dev tool: explore all features across all policies
│   │   ├── GradedExplorer.tsx  ← Dev tool: see graded features with filter
│   │   ├── OutBrowser.tsx      ← Dev tool: raw JSON browser for out/ files
│   │   └── admin/              ← Admin pages (require ADMIN_TOKEN, Supabase not wired)
│   ├── components/
│   │   ├── Header.tsx          ← Top nav bar
│   │   ├── HeroSection.tsx     ← Wrapper with gradient background
│   │   ├── Footer.tsx          ← Footer with disclaimer
│   │   ├── ResultsSection.tsx  ← Policy analysis results view
│   │   └── FeatureSection.tsx  ← Collapsible feature group (great/good/bad/unclear)
│   ├── lib/
│   │   ├── mockData.ts         ← TypeScript types for PolicyAnalysis, PolicyFeature
│   │   └── adminApi.ts         ← Admin API client (not fully wired)
│   └── utils/
│       └── pdfExtractor.ts     ← Client-side PDF text extraction via pdfjs-dist
├── scripts/
│   ├── regrade_all.mjs         ← Re-grade all policies via OpenAI (main pipeline script)
│   ├── fix_copay.mjs           ← Post-processor: enforce co-pay → BAD rule deterministically
│   ├── clean_feature_names.mjs ← Algorithmic feature name cleanup
│   ├── verify_outputs.mjs      ← Validate all out/ JSONs for schema correctness
│   ├── spot_check.mjs          ← Manually verify a single policy's grading
│   ├── qa_identify.mjs         ← 70-test suite for policy identification accuracy
│   └── archive/                ← One-time data processing scripts (historical, not needed)
└── .env                        ← OPENAI_API_KEY, ADMIN_TOKEN, API_PORT
```

---

## Data Model

Each policy is a single JSON file at `out/<insurer-id>/<Policy_Name>.json`:

```ts
{
  policyName: string;          // "Optima Secure"
  insurer: string;             // "HDFC ERGO"
  sumInsured: string;          // "₹5L – ₹2Cr" or "Varies by plan"
  policyType: string;          // "Individual | Family Floater" | "Senior" | "Top-up" | "Family Floater"
  documentType: string;        // "Policy Wording" | "Product Brochure"
  summary: {
    great: number;             // count of best-in-class features
    good: number;
    bad: number;
    unclear: number;
  };
  features: {
    great: PolicyFeature[];
    good: PolicyFeature[];
    bad: PolicyFeature[];
    unclear: PolicyFeature[];
  };
  disclaimer: string;          // "This analysis is for informational purposes..."
}

// PolicyFeature
{
  name: string;        // "Room Rent", "PED Waiting Period", "Co-pay" (2–5 words)
  quote: string;       // verbatim text extracted from the policy wording
  reference: string;   // "Section 3.2 — Room Rent" or "Page 12"
  explanation: string; // 2-sentence plain English consumer explanation
}
```

---

## API Endpoints

All served by Express on port 3001.

### GET `/api/policies`
Returns the full library of insurers and their policies (light version — names and summary counts only, no features).

```json
{
  "insurers": [
    {
      "id": "hdfc-ergo",
      "label": "HDFC ERGO",
      "policies": [
        {
          "id": "Optima_Secure",
          "policyName": "Optima Secure",
          "policyType": "Individual | Family Floater",
          "summary": { "great": 5, "good": 8, "bad": 3, "unclear": 1 }
        }
      ]
    }
  ]
}
```

### GET `/api/policies/:insurer/:policy`
Returns the full JSON for a single policy (all features with quotes and explanations).

Example: `GET /api/policies/hdfc-ergo/Optima_Secure`

### POST `/api/policies/identify`
Identifies which pre-analysed policy matches an uploaded PDF.

**Request body:** `{ "text": "<first ~20,000 chars of extracted PDF text>" }`

**Response (matched):**
```json
{ "matched": true, "insurerId": "hdfc-ergo", "policyId": "Optima_Secure", "data": { ...full policy JSON... } }
```

**Response (not matched):**
```json
{ "matched": false, "reason": "Insurer not recognised. We currently support..." }
```

The identification algorithm:
1. Reject non-health documents (detects life/motor/travel keywords)
2. Validate it's a health policy (needs ≥3 health keywords)
3. Identify insurer by matching patterns (e.g. "hdfc ergo general insurance") — picks longest match
4. Score each policy within that insurer against the first 8,000 chars of extracted text
5. Returns the best match if score ≥ 10, otherwise returns insurer but no policy match

---

## How to Run Locally

```bash
# Install dependencies
npm install

# Create .env file
echo "OPENAI_API_KEY=sk-..." > .env
echo "API_PORT=3001" >> .env

# Start both frontend (port 5173) and backend (port 3001)
npm run dev:all

# Or start separately:
npm run dev       # Vite frontend
npm run dev:api   # Express backend
```

---

## Grading Rubric

The rubric used for AI grading (in `scripts/regrade_all.mjs`):

| Feature | GREAT | GOOD | BAD |
|---------|-------|------|-----|
| **Room Rent** | At Actuals / No limit | Single Private AC room | Any rupee cap or % of SI cap |
| **PED Waiting** | < 24 months | 24–48 months | > 48 months |
| **Initial Waiting** | 0 days | — | > 0 days |
| **Co-pay** | Zero mention in document | — | ANY mention (optional, age-based, PPN, etc.) |
| **Restore Benefit** | Covers same illness / Unlimited | Restores once, different illness | No restore |
| **Consumables** | Fully covered | — | Excluded |
| **Pre-hospitalisation** | > 60 days | 30–60 days | < 30 days |
| **Post-hospitalisation** | > 180 days | 60–180 days (incl. exactly 180) | < 60 days |
| **AYUSH** | Full SI limit | Sub-limit | Not covered |
| **NCB** | > 50% per year | ≤ 50% per year | Resets on claim |

**Important:** The co-pay rule is absolute. Even "optional" or "PPN-network" co-pay = BAD. After each regrade run, also run `scripts/fix_copay.mjs` to enforce this deterministically (the AI occasionally misses it).

---

## How to Add a New Policy

1. Get the policy wording PDF and place it in `policy-wording/<insurer-id>/Policy_Name.pdf`

2. Add the insurer to `INSURER_META` in `server/routes/policies.ts` if it's a new insurer

3. Run the regrade script against just that policy:
   ```bash
   source ~/.nvm/nvm.sh
   node scripts/regrade_all.mjs <insurer-id>/<Policy_Name>
   ```
   This creates `out/<insurer-id>/Policy_Name.json`

4. Run the co-pay post-processor:
   ```bash
   node scripts/fix_copay.mjs
   ```

5. Verify the output:
   ```bash
   node scripts/spot_check.mjs <insurer-id>/<Policy_Name>
   node scripts/verify_outputs.mjs
   ```

6. Restart the API server — it reads files at request time, no rebuild needed.

---

## What's Prototype vs. What Needs Production Work

### Already solid (keep as-is or build on)
- **Policy analysis data** — 103 policies × ~15 features, graded and explained. The JSON schema is clean and well-structured. This is the real value of the project.
- **Grading rubric** — battle-tested over multiple iterations. Lives in `scripts/regrade_all.mjs`.
- **Policy identification logic** — `server/routes/policies.ts`. Works well for the 103 known policies.
- **Feature display UI** — `FeatureSection.tsx` and `ResultsSection.tsx` are clean and complete.

### Needs production work

**1. No real database**
All data is static JSON files checked into the repo. For production you need:
- A proper database (PostgreSQL recommended) to store policies, features, versions
- An admin interface to update individual feature gradings without re-running the full AI pipeline
- Versioning so you can track changes as policy wordings update

**2. PDF upload is a "best guess"**
The identification algorithm matches by text similarity. It works for the 103 known policies but will fail for:
- New policies not in the library
- Policy schedules (not wordings)
- Renewal certificates
- Poorly scanned PDFs

For production: either expand the library, or add a "live AI analysis" path for unknown policies (the `/api/analyze` route is a start but not wired to the UI).

**3. No authentication**
Any user can access any policy. The admin routes exist but are protected only by a static bearer token (not Supabase — that integration was scaffolded but never wired).

**4. Data staleness**
Policy wordings change. The current 103 analyses reflect the PDFs processed in the initial run (early 2025). Production needs a process to detect and re-analyse updated wordings.

**5. Disclaimer**
The current disclaimer is minimal. A production version needs proper legal review — this tool provides guidance, not advice.

**6. Mobile experience**
The app is responsive but was primarily designed for desktop. The results view on mobile could be improved.

**7. Dev-only routes**
The `/features`, `/graded`, `/out`, `/policies` browser routes and the `/admin` routes are dev tools. In production, either remove or properly protect them.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | For regrading only | Used by `scripts/regrade_all.mjs`. Not needed at runtime for the web app. |
| `API_PORT` | No (default: 3001) | Port for the Express backend |
| `ADMIN_TOKEN` | No | Bearer token for `/api/admin` routes |
| `VITE_API_URL` | No (default: http://localhost:3001) | Frontend uses this to reach the backend |

---

## Key Decisions & Why

**Why pre-analysed JSONs instead of live AI?**
Speed and cost. Running OpenAI on a 50-page policy wording takes 30–60 seconds and costs ~$0.05 per policy. For a prototype this is unacceptable UX. Pre-baking lets the app respond in < 100ms.

**Why Express + Vite separately instead of Next.js?**
The prototype was scaffolded in Lovable (a React + Vite starter). Migrating to Next.js would be a clean option for production — it would simplify deployment and allow server-side rendering.

**Why gpt-4.1-mini for grading?**
Best balance of accuracy and cost for structured JSON output tasks. The rubric is explicit enough that the smaller model performs well. GPT-4o would give marginal improvement at 10× the cost.

**Why is co-pay post-processed separately?**
The AI occasionally puts co-pay in UNCLEAR ("percentage not stated") or GOOD ("optional co-pay for non-PPN network"). The post-processor `fix_copay.mjs` deterministically enforces the business rule regardless of AI output.
