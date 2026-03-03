# Architecture Guide

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                              │
│                                                             │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ Upload   │───▶│ pdfExtractor │───▶│ policyAnalyzer   │  │
│  │ Section  │    │ (pdf.js)     │    │ (supabase SDK)   │  │
│  └──────────┘    └──────────────┘    └────────┬─────────┘  │
│                                               │             │
│  ┌──────────────────────────────────┐         │             │
│  │ ResultsSection                   │◀────────┘             │
│  │  ├─ SummaryCard                  │                       │
│  │  └─ FeatureSection (x4)         │                       │
│  └──────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
                            │
                    HTTPS (Supabase SDK)
                            │
┌─────────────────────────────────────────────────────────────┐
│                   SUPABASE EDGE FUNCTION                    │
│                                                             │
│  analyze-policy/index.ts                                    │
│  ┌──────────────────┐  ┌─────────────────────────────────┐ │
│  │ Input Validation  │  │ Document Validation             │ │
│  │ • Size check      │  │ • Health insurance keyword scan │ │
│  │ • Length check     │  │ • Minimum keyword threshold    │ │
│  │ • Sanitization     │  │                                │ │
│  └────────┬─────────┘  └────────────┬────────────────────┘ │
│           │                          │                      │
│           ▼                          ▼                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Anthropic API Call                                    │  │
│  │ • Model: claude-sonnet-4-20250514                     │  │
│  │ • System prompt: ~400 lines of domain rules           │  │
│  │ • Tool use: submit_policy_analysis (structured JSON)  │  │
│  │ • Max tokens: 8192                                    │  │
│  └────────────────────────┬─────────────────────────────┘  │
│                           │                                 │
│  ┌────────────────────────▼─────────────────────────────┐  │
│  │ Response Normalization                                │  │
│  │ • Extract tool_use block                              │  │
│  │ • Normalize features structure                        │  │
│  │ • Generate summary counts if missing                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Component Hierarchy

```
App.tsx
├── QueryClientProvider (React Query)
├── TooltipProvider
├── Toaster (toast notifications)
├── Sonner (sonner notifications)
└── BrowserRouter
    └── Routes
        ├── "/" → Index.tsx
        │   ├── Header
        │   ├── HeroSection (wrapper)
        │   │   ├── UploadSection      (when state = "upload")
        │   │   ├── LoadingState       (when state = "extracting" | "analyzing")
        │   │   └── ResultsSection     (when state = "results")
        │   │       ├── SummaryCard
        │   │       ├── FeatureSection  (great, defaultOpen)
        │   │       ├── FeatureSection  (good)
        │   │       ├── FeatureSection  (bad, defaultOpen)
        │   │       └── FeatureSection  (unclear)
        │   └── Footer
        └── "*" → NotFound
```

## State Machine (Index.tsx)

The main page uses a simple state machine with 4 states:

```
  "upload" ──▶ "extracting" ──▶ "analyzing" ──▶ "results"
     ▲              │                │               │
     └──────────────┴────────────────┴───────────────┘
                    (on error or reset)
```

| State | UI | Trigger |
|-------|-----|---------|
| `upload` | Upload dropzone | Initial / reset / error |
| `extracting` | Loading spinner "Extracting text..." | User clicks "Analyze Policy" |
| `analyzing` | Loading spinner "Analyzing policy..." | Text extraction succeeds |
| `results` | Summary + categorized features | AI analysis succeeds |

## Data Flow

### 1. PDF Text Extraction (`src/utils/pdfExtractor.ts`)

```
File → ArrayBuffer → pdf.js → Page-by-page text extraction → Full text string
```

**Validations performed:**
- Password-protected PDF detection (`PasswordException`)
- Corrupted PDF detection (`InvalidPDFException`)
- Scanned/image-based PDF detection (< 100 chars extracted)
- Insurance document validation (keyword matching across categories: health, life, auto, home)

**Insurance document detection** requires:
- ≥ 3 matches from general insurance keywords (policy, coverage, premium, etc.)
- ≥ 2 matches from any specific insurance type (health, life, auto, home)

### 2. AI Analysis (`supabase/functions/analyze-policy/index.ts`)

**Server-side validations:**
- Request size ≤ 25MB
- Text length: 100–500,000 chars
- Input sanitization (control character removal)
- Health insurance keyword check (≥ 3 keyword matches)

**AI call structure:**
- Uses Anthropic's **tool use** feature to force structured JSON output
- The tool schema (`submit_policy_analysis`) defines the exact response shape
- `tool_choice: { type: "tool", name: "submit_policy_analysis" }` forces the model to always use this tool

**Response normalization:**
- Handles cases where features might be at root level vs nested under `features` key
- Auto-generates summary counts from feature array lengths if not provided

### 3. Client Service (`src/services/policyAnalyzer.ts`)

- Calls edge function via `supabase.functions.invoke('analyze-policy', { body: { policyText } })`
- Custom error classes: `PolicyAnalysisError`, `InvalidDocumentError`
- Distinguishes between invalid document errors (user-actionable) and system errors

## Error Handling Strategy

```
Client Errors (pdfExtractor.ts)          Server Errors (edge function)
├── PASSWORD_PROTECTED                   ├── 400: invalid_document
├── SCANNED_PDF                          ├── 400: text too short
├── CORRUPTED                            ├── 413: payload too large
├── NOT_A_POLICY                         └── 500: AI failure (generic message)
└── UNKNOWN
```

All errors surface as toast notifications in the UI. Internal error details are logged server-side but never exposed to the user.

## AI Prompt Engineering Notes

The system prompt in the edge function is the most critical piece of the system. Key design patterns:

1. **Lookup tables** — Specific thresholds for each feature (e.g., "PED ≤ 48 months = GOOD")
2. **Anti-patterns** — Explicit "DO NOT" instructions to prevent common AI mistakes
3. **Self-check prompts** — "Before submitting, verify: ☐ PED 24-48 months is in GOOD..."
4. **Few-shot examples** — Concrete examples of correct vs incorrect categorization
5. **Two-layer prompting** — System prompt sets rules, user prompt reinforces key rules with decision questions

## Design System

All colors use HSL semantic tokens defined in `src/index.css`:

- `--background`, `--foreground` — Page base
- `--primary`, `--primary-foreground` — Brand / CTA
- `--card`, `--card-foreground` — Card surfaces
- `--muted`, `--muted-foreground` — Secondary text
- `--destructive` — Error states
- `--border`, `--ring` — Borders and focus rings

Custom font classes: `font-display` (headings), `font-body` (body text)

## Security Considerations

- API key (`ANTHROPIC_API_KEY`) is stored as an edge function secret, never exposed to client
- Input is sanitized server-side (control characters removed)
- Request size is limited (25MB max)
- Policy text is NOT stored anywhere — analyzed and discarded
- CORS headers allow all origins (acceptable for prototype; tighten for production)
