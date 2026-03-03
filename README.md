# Guardian One — Insurance Policy Analyzer

> **Prototype / Proof of Concept** — Built by Product for handoff to the dev team. This is a specification and working demo that should guide production-level implementation decisions.

**Live Demo:** [guardian-policy-decoder.lovable.app](https://guardian-policy-decoder.lovable.app)

---

## What Is This?

An AI-powered web app that lets users upload an insurance policy PDF and instantly receive a structured, plain-English breakdown of their coverage — categorized as **Great**, **Good**, **Bad**, or **Unclear**.

Currently focused on **Indian health insurance** policies, with the prompt and validation rules tuned to IRDAI standards.

---

## How It Works (User Flow)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Upload PDF  │ ──▶ │ Extract Text │ ──▶ │ AI Analysis      │ ──▶ │ Show Results │
│  (client)    │     │ (client,     │     │ (Edge Function + │     │ (client)     │
│              │     │  pdf.js)     │     │  Anthropic API)  │     │              │
└──────────────┘     └──────────────┘     └──────────────────┘     └──────────────┘
```

1. **Upload** — User drops a PDF (max 20MB). Client validates file type + size.
2. **Extract** — `pdfjs-dist` extracts text client-side. Checks for password protection, scanned PDFs, and non-insurance documents.
3. **Analyze** — Extracted text is sent to a Supabase Edge Function (`analyze-policy`) which calls the Anthropic API with a detailed system prompt and structured tool output.
4. **Results** — The structured response is rendered as categorized feature cards with policy quotes, explanations, and section references.

---

## Project Structure

```
├── src/
│   ├── App.tsx                    # Root — providers, routing
│   ├── pages/
│   │   └── Index.tsx              # Main page — state machine (upload → extracting → analyzing → results)
│   ├── components/
│   │   ├── Header.tsx             # Top nav bar with logo + nav links
│   │   ├── HeroSection.tsx        # Hero container/wrapper
│   │   ├── UploadSection.tsx      # Drag-and-drop PDF upload with validation
│   │   ├── LoadingState.tsx       # Progress indicator during extraction/analysis
│   │   ├── ResultsSection.tsx     # Results container — summary + feature sections
│   │   ├── SummaryCard.tsx        # Score overview card (great/good/bad/unclear counts)
│   │   ├── FeatureSection.tsx     # Collapsible section per category (great/good/bad/unclear)
│   │   ├── Footer.tsx             # Page footer
│   │   └── NavLink.tsx            # Reusable nav link component
│   ├── services/
│   │   └── policyAnalyzer.ts      # Client service — calls the edge function via Supabase SDK
│   ├── utils/
│   │   └── pdfExtractor.ts        # PDF text extraction + document validation (client-side)
│   ├── lib/
│   │   ├── mockData.ts            # Mock analysis data (types + sample data for dev/testing)
│   │   └── utils.ts               # Tailwind merge utility
│   ├── integrations/supabase/
│   │   ├── client.ts              # Auto-generated Supabase client (DO NOT EDIT)
│   │   └── types.ts               # Auto-generated DB types (DO NOT EDIT)
│   └── index.css                  # Design tokens, custom fonts, theme variables
│
├── supabase/
│   └── functions/
│       └── analyze-policy/
│           └── index.ts           # Edge Function — the core AI analysis logic
│
└── docs/
    └── ARCHITECTURE.md            # Detailed architecture and API contracts
```

---

## Key Technical Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| PDF parsing | Client-side (`pdfjs-dist`) | No server load for extraction; instant feedback on bad files |
| AI model | Anthropic Claude (via Edge Function) | Structured tool output ensures consistent JSON schema |
| State management | Local React state (`useState`) | Single-page flow, no cross-route state needed |
| Styling | Tailwind CSS + shadcn/ui + semantic tokens | Consistent design system, easy theming |
| Backend | Supabase Edge Functions (Deno) | Serverless, auto-scaling, keeps API keys server-side |
| Document validation | Two-layer (client keyword check + server validation) | Fast client feedback + secure server-side gate |

---

## The AI Prompt (Important for Production)

The edge function at `supabase/functions/analyze-policy/index.ts` contains an extensive system prompt (~400 lines) that encodes **domain expertise** for Indian health insurance analysis. Key aspects:

- **Categorization rules** — Exact thresholds for what counts as Great/Good/Bad/Unclear (e.g., PED ≤48 months = Good, >48 = Bad)
- **IRDAI standard exclusions** — 20+ exclusions that should NEVER be flagged (cosmetic surgery, infertility, etc.)
- **Optional vs Mandatory distinction** — Optional add-ons with trade-offs are Good, mandatory restrictions may be Bad
- **Structured output via tool use** — Forces the AI to return a specific JSON schema with `policyName`, `insurer`, `sumInsured`, `features`, etc.

> ⚠️ **For production:** This prompt is the core IP. It should be version-controlled, A/B tested, and refined based on user feedback.

---

## API Contract

### Edge Function: `analyze-policy`

**Request:**
```json
{
  "policyText": "string (100–500,000 chars of extracted PDF text)"
}
```

**Success Response (200):**
```json
{
  "policyName": "HDFC Ergo Optima Secure",
  "insurer": "HDFC Ergo",
  "sumInsured": "₹10,00,000",
  "policyType": "Individual | Family Floater | Not specified",
  "documentType": "Policy Wording | Brochure | Policy Schedule | Mixed",
  "summary": { "great": 5, "good": 4, "bad": 2, "unclear": 1 },
  "features": {
    "great": [{ "name": "...", "quote": "...", "reference": "...", "explanation": "..." }],
    "good": [...],
    "bad": [...],
    "unclear": [...]
  },
  "disclaimer": "Standard IRDAI exclusions apply..."
}
```

**Error Responses:**
| Status | Body | When |
|--------|------|------|
| 400 | `{ "error": "invalid_document", "message": "...", "detectedType": "..." }` | Not a health insurance doc |
| 400 | `{ "error": "Policy text is too short or empty" }` | < 100 chars |
| 413 | `{ "error": "Request payload too large..." }` | > 25MB request |
| 500 | `{ "error": "We encountered an issue..." }` | AI API failure |

---

## Environment & Secrets

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_SUPABASE_URL` | `.env` (auto) | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env` (auto) | Supabase anon key |
| `ANTHROPIC_API_KEY` | Edge Function secret | Claude API access |

---

## Local Development

```bash
# Prerequisites: Node.js 18+, npm or bun

git clone https://github.com/neetdodhiaprod/guardian-policy-insights.git
cd guardian-policy-insights

npm install    # or: bun install
npm run dev    # starts Vite dev server at localhost:5173
```

> **Note:** The AI analysis won't work locally without the Supabase Edge Function running. The edge function is deployed automatically via Lovable Cloud.

---

## Known Limitations & TODOs

- [ ] **PDF Download** — "Download PDF Report" button is stubbed (`TODO` in `ResultsSection.tsx`)
- [ ] **Nav links** — Header nav links (`Why Us`, `Health Insurance 101`, `Calculator`, `Claims`) are placeholder `#` links
- [ ] **No auth** — No user authentication; policies are not stored
- [ ] **No history** — Users can't revisit past analyses
- [ ] **Single policy type** — Prompt is tuned for health insurance only; life/auto/home keywords are detected but not analyzed
- [ ] **No mobile menu** — Nav is hidden on mobile (`hidden md:flex`)
- [ ] **Model dependency** — Currently using `claude-sonnet-4-20250514`; model availability should be handled with fallbacks

---

## For the Dev Team

1. **Start with the edge function** — `supabase/functions/analyze-policy/index.ts` is the brain. Understand the prompt, the tool schema, and the validation logic.
2. **The prompt IS the product** — Most product improvements come from refining the system prompt, not the UI.
3. **Types are shared** — `PolicyFeature` and `PolicyAnalysis` interfaces in `src/lib/mockData.ts` and `src/services/policyAnalyzer.ts` mirror the edge function's tool schema. Keep them in sync.
4. **Mock data exists** — `src/lib/mockData.ts` has realistic sample data for UI development without hitting the API.
5. **Design tokens** — All colors use HSL semantic tokens defined in `src/index.css`. Don't hardcode colors.
