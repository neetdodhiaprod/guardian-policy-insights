# Insurance Policy Analyzer

An AI-powered web application that analyzes insurance policy documents and provides clear, actionable insights about your coverage.

## What It Does

Upload your insurance policy PDF and get an instant, easy-to-understand breakdown of:

- **Great Features** - Excellent coverage provisions that protect you well
- **Good Features** - Standard benefits included in your policy
- **Bad Features** - Limitations, exclusions, or concerning clauses to be aware of
- **Unclear Features** - Ambiguous language that may need clarification

For each feature identified, the tool provides:
- The exact policy quote/reference
- A plain-English explanation of what it means for you
- The section reference for easy lookup

## How It Works

1. **Upload** - Drag and drop or select your insurance policy PDF (max 20MB)
2. **Extract** - The tool extracts text from your document
3. **Analyze** - AI analyzes the policy content for key provisions
4. **Review** - Get categorized results with explanations and references

## Technology Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Lovable Cloud (Supabase Edge Functions)
- **AI**: Google Gemini for policy analysis
- **PDF Processing**: pdf.js for client-side text extraction

## Features

- Responsive design for desktop and mobile
- Real-time loading states with progress indicators
- Client-side PDF validation (file type and size)
- Server-side input sanitization and validation
- Privacy-focused: policies are analyzed but not stored

## Getting Started

### Prerequisites

- Node.js & npm installed ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))

### Local Development

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to project directory
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Variables

The following environment variables are configured automatically via Lovable Cloud:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

For the AI analysis to work, ensure the `GOOGLE_GEMINI_API_KEY` secret is configured in your project settings.

## Deployment

Open [Lovable](https://lovable.dev) and click Share → Publish to deploy your app.

## Custom Domain

To connect a custom domain, navigate to Project → Settings → Domains in Lovable.

## License

This project is private. All rights reserved.
