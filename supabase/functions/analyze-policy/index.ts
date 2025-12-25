import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Policy analysis tool
const policyAnalysisTool = {
  name: "submit_policy_analysis",
  description: "Submit the structured analysis of a health insurance policy document",
  input_schema: {
    type: "object" as const,
    properties: {
      policyName: { type: "string", description: "Name of the policy or 'Not specified'" },
      insurer: { type: "string", description: "Insurance company name or 'Not specified'" },
      sumInsured: { type: "string", description: "Sum insured amount or 'Not specified'" },
      policyType: { type: "string", enum: ["Individual", "Family Floater", "Not specified"] },
      documentType: { type: "string", enum: ["Policy Wording", "Brochure", "Policy Schedule", "Mixed"] },
      summary: {
        type: "object",
        properties: {
          great: { type: "number" },
          good: { type: "number" },
          bad: { type: "number" },
          unclear: { type: "number" }
        },
        required: ["great", "good", "bad", "unclear"]
      },
      features: {
        type: "object",
        properties: {
          great: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                quote: { type: "string" },
                reference: { type: "string" },
                explanation: { type: "string" }
              },
              required: ["name", "quote", "reference", "explanation"]
            }
          },
          good: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                quote: { type: "string" },
                reference: { type: "string" },
                explanation: { type: "string" }
              },
              required: ["name", "quote", "reference", "explanation"]
            }
          },
          bad: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                quote: { type: "string" },
                reference: { type: "string" },
                explanation: { type: "string" }
              },
              required: ["name", "quote", "reference", "explanation"]
            }
          },
          unclear: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                quote: { type: "string" },
                reference: { type: "string" },
                explanation: { type: "string" }
              },
              required: ["name", "quote", "reference", "explanation"]
            }
          }
        },
        required: ["great", "good", "bad", "unclear"]
      },
      disclaimer: { type: "string" }
    },
    required: ["policyName", "insurer", "sumInsured", "policyType", "documentType", "summary", "features", "disclaimer"]
  }
};

const analysisSystemPrompt = `You are an expert Indian health insurance policy analyzer.

══════════════════════════════════════════════════════════════
CLASSIFICATION RULES - FOLLOW EXACTLY
══════════════════════════════════════════════════════════════

WAITING PERIODS:
| Type              | GREAT      | GOOD         | RED FLAG    |
|-------------------|------------|--------------|-------------|
| PED               | ≤12 months | 24-48 months | >48 months  |
| Specific Illness  | ≤12 months | 24 months    | >24 months  |
| Initial           | 0 days     | 30 days      | >30 days    |

ROOM RENT:
| Term                              | Category |
|-----------------------------------|----------|
| "At Actuals" / "No limit"         | GREAT    |
| "Single Private AC"               | GOOD     |
| Daily cap (₹3K-₹10K/day)          | RED FLAG |
| Proportionate deduction clause    | RED FLAG |

PRE/POST HOSPITALIZATION:
| Pre-hosp    | Post-hosp   | Category |
|-------------|-------------|----------|
| ≥60 days    | ≥180 days   | GREAT    |
| 30-59 days  | 60-179 days | GOOD     |
| <30 days    | <60 days    | RED FLAG |

══════════════════════════════════════════════════════════════
GREAT FEATURES (Better than market)
══════════════════════════════════════════════════════════════

- Room rent at actuals/no limit
- Pre-hosp ≥60 days, Post-hosp ≥180 days
- Restore/Reset: Unlimited or same illness covered
- Consumables fully covered (Protect Benefit)
- 2X/3X/4X coverage multipliers
- Auto SI increase regardless of claims
- Air ambulance, No co-pay any age
- No geography-based co-pay
- Worldwide cover, Lifelong renewal

══════════════════════════════════════════════════════════════
GOOD FEATURES (Market standard)
══════════════════════════════════════════════════════════════

- Room rent: Single Private AC
- PED: 24-48 months (incl. 36 months)
- Specific illness: 24 months
- Initial waiting: 30 days
- Pre-hosp: 30-59 days, Post-hosp: 60-179 days
- Restore for different illness only
- Co-pay 10-20% for 60+ only
- AYUSH, Day care, Domiciliary covered
- Ambulance, Health check-up, Donor expenses
- Cashless network, Optional add-ons
- Daily cash for shared room (any amount)
- Voluntary deductible with discount

══════════════════════════════════════════════════════════════
RED FLAGS (Must flag if present)
══════════════════════════════════════════════════════════════

- Proportionate deduction clause
- Room rent daily cap in rupees
- PED >48 months, Specific illness >24 months
- Mandatory co-pay ALL ages
- Disease sub-limits (name exact disease + limit)
- PPN/Network co-pay penalty (10-20% outside network)
- No restore benefit, Consumables not covered

══════════════════════════════════════════════════════════════
NEVER FLAG AS RED FLAG
══════════════════════════════════════════════════════════════

- 24-month specific illness (GOOD)
- 36-month PED (GOOD)
- 48-month PED (GOOD)
- "Multiple exclusions" (lazy - not allowed)
- Daily cash benefit (BONUS = GOOD)
- Standard IRDAI exclusions
- Voluntary deductible options

STANDARD IRDAI EXCLUSIONS (never mention):
Cosmetic, Obesity, Infertility, Maternity (base), Dental, 
Spectacles, Vitamins, Self-harm, War, Hazardous sports, 
Alcohol/drugs, Experimental, Vaccination, Rest cures

══════════════════════════════════════════════════════════════
UNCLEAR (Only if genuinely vague)
══════════════════════════════════════════════════════════════

- Conflicting statements
- Benefit without details
- "Company discretion" without criteria

NOT unclear: Waiting periods, room rent terms, add-ons with prices

══════════════════════════════════════════════════════════════
OUTPUT
══════════════════════════════════════════════════════════════

- GREAT: All that qualify (typically 4-8)
- GOOD: All that qualify (typically 5-10)
- RED FLAGS: ONLY genuine issues (can be 0 if none exist)
- UNCLEAR: ONLY genuinely vague items (can be 0)

DO NOT invent red flags. Many good policies have 0 red flags.

Each feature: name, quote (<100 chars), reference, explanation (1-2 sentences, "you/your")

══════════════════════════════════════════════════════════════
MUST INCLUDE (if in policy)
══════════════════════════════════════════════════════════════

Room rent, PED waiting, Specific illness waiting, Initial waiting,
Pre/Post hospitalization, Restore benefit, Cashless network,
Proportionate deduction (if present), Co-pay terms (if any)

══════════════════════════════════════════════════════════════
CHECKLIST BEFORE SUBMIT
══════════════════════════════════════════════════════════════

□ 24-month specific illness in GOOD
□ 36/48-month PED in GOOD
□ Pre/Post ≥60/180 in GREAT
□ Proportionate deduction in RED FLAG (if exists)
□ No "multiple exclusions" anywhere
□ No IRDAI exclusions mentioned
□ Counts match actual features`;

// Code-based document validation (no API call needed)
function validateDocument(text: string): { valid: boolean; error?: string } {
  if (!text || text.length < 500) {
    return { valid: false, error: "Document too short. Please upload complete policy." };
  }
  
  const lower = text.substring(0, 10000).toLowerCase();
  const healthKeywords = ['health insurance', 'hospitalization', 'sum insured', 'cashless', 'waiting period', 'room rent', 'co-pay', 'irdai', 'claim', 'pre-existing'];
  const matches = healthKeywords.filter(k => lower.includes(k)).length;
  
  if (matches < 3) {
    return { valid: false, error: "This doesn't appear to be a health insurance policy. Please upload a valid policy document." };
  }
  
  return { valid: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate content length before processing
    const MAX_REQUEST_SIZE = 25 * 1024 * 1024; // 25MB to account for base64 encoding overhead
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
      console.warn(`Request too large: ${contentLength} bytes`);
      return new Response(
        JSON.stringify({ error: 'Request payload too large. Maximum file size is 20MB.' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { policyText } = await req.json();

    // Input validation
    const MIN_TEXT_LENGTH = 100;
    const MAX_TEXT_LENGTH = 500000; // ~500KB

    if (!policyText || policyText.trim().length < MIN_TEXT_LENGTH) {
      return new Response(
        JSON.stringify({ error: 'Policy text is too short or empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (policyText.length > MAX_TEXT_LENGTH) {
      return new Response(
        JSON.stringify({ error: 'Policy text exceeds maximum allowed length of 500KB' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize input: remove control characters except newlines/tabs/carriage returns
    const sanitizedPolicyText = policyText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    console.log(`Analyzing policy text (${sanitizedPolicyText.length} characters)`);

    // Validate document using code (no API call needed)
    const validation = validateDocument(sanitizedPolicyText);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ 
          error: 'invalid_document',
          message: validation.error,
          detectedType: 'Not Health Insurance'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('Document validation passed (code-based)');

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      console.error('ANTHROPIC_API_KEY not configured');
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    // Full policy analysis with retry logic
    const MAX_RETRIES = 2;
    let result = null;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      console.log(`Running analysis attempt ${attempt}/${MAX_RETRIES}...`);
      
      const analysisResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 8192,
          temperature: 0.3,
          system: analysisSystemPrompt,
          tools: [policyAnalysisTool],
          tool_choice: { type: "tool", name: "submit_policy_analysis" },
          messages: [
            {
              role: 'user',
              content: `Analyze this health insurance policy.

CRITICAL:
- 24-month specific illness = GOOD (NOT red flag)
- 36-month PED = GOOD (NOT red flag)  
- Do NOT invent red flags. 0 red flags is OK for good policies.
- Only flag proportionate deduction if policy ACTUALLY has it.

Policy:
${sanitizedPolicyText}`
            }
          ]
        }),
      });

      if (!analysisResponse.ok) {
        const errorText = await analysisResponse.text();
        console.error('Analysis error:', analysisResponse.status, errorText);
        throw new Error(`Policy analysis failed: ${analysisResponse.status}`);
      }

      const analysisData = await analysisResponse.json();
      
      // Log API response details for debugging
      console.log('API response stop_reason:', analysisData.stop_reason);
      console.log('API response usage:', JSON.stringify(analysisData.usage));
      
      const analysisToolUse = analysisData.content?.find((block: any) => block.type === 'tool_use');
      
      if (!analysisToolUse || analysisToolUse.type !== 'tool_use') {
        console.error('Invalid response format. Content:', JSON.stringify(analysisData.content));
        throw new Error('Policy analysis failed - invalid response format');
      }

      result = analysisToolUse.input;
      
      // Log feature counts
      const featureCounts = {
        policy: result.policyName,
        insurer: result.insurer,
        great: result.features?.great?.length || 0,
        good: result.features?.good?.length || 0,
        bad: result.features?.bad?.length || 0,
        unclear: result.features?.unclear?.length || 0,
      };
      console.log('Analysis complete:', JSON.stringify(featureCounts));
      
      // Check if we got features
      const totalFeatures = featureCounts.great + featureCounts.good + featureCounts.bad + featureCounts.unclear;
      if (totalFeatures > 0) {
        console.log('Features extracted successfully, returning result');
        break;
      }
      
      // No features found, retry if we have attempts left
      if (attempt < MAX_RETRIES) {
        console.warn(`WARNING: No features extracted on attempt ${attempt}. Retrying...`);
      } else {
        console.error('ERROR: No features extracted after all retries!');
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    // Log full error details server-side for debugging
    console.error('Error details:', error);
    
    // Return user-friendly message without exposing internal details
    const isInvalidDocument = error instanceof Error && error.message.includes('invalid_document');
    const userMessage = isInvalidDocument 
      ? (error as Error).message 
      : 'We encountered an issue analyzing your policy. Please try again.';
    
    return new Response(
      JSON.stringify({ error: userMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
