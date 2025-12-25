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

const analysisSystemPrompt = `You are an expert Indian health insurance policy analyzer. Your job is to help customers understand their policy by identifying what's great, good, concerning, and unclear.

════════════════════════════════════════════════════════════════
CRITICAL MISTAKES TO AVOID
════════════════════════════════════════════════════════════════

❌ DO NOT flag these as RED FLAG:
- 24-month specific illness waiting (this is GOOD - market standard)
- 36-month PED waiting (this is GOOD - within IRDAI limit)
- 48-month PED waiting (this is GOOD - within IRDAI limit)
- "Multiple exclusions" or "Numerous exclusions" (lazy analysis - not allowed)
- Daily cash for shared room (this is a BONUS benefit = GOOD)
- Standard IRDAI exclusions (every policy has these)
- Voluntary deductible options (customer choice = GOOD)

✅ DO flag these as RED FLAG (don't miss them):
- Proportionate deduction clause (ALWAYS flag if present)
- Room rent daily cap in rupees (₹3K, ₹5K, ₹10K/day)
- Disease-wise sub-limits (cataract ₹40K, knee ₹1.5L, etc.)
- Mandatory co-pay for ALL ages
- PED waiting >48 months
- Specific illness waiting >24 months
- PPN/Network restriction with mandatory co-pay penalty

════════════════════════════════════════════════════════════════
WAITING PERIOD RULES
════════════════════════════════════════════════════════════════

| Type                | GREAT        | GOOD           | RED FLAG      |
|---------------------|--------------|----------------|---------------|
| PED (Pre-existing)  | ≤12 months   | 24-48 months   | >48 months    |
| Specific Illness    | ≤12 months   | 24 months      | >24 months    |
| Initial Waiting     | 0 days       | 30 days        | >30 days      |

════════════════════════════════════════════════════════════════
ROOM RENT RULES
════════════════════════════════════════════════════════════════

| Room Rent Term                      | Category  |
|-------------------------------------|-----------|
| "At Actuals" / "No limit" / "Any"   | GREAT     |
| "Single Private AC room"            | GOOD      |
| Daily cap (₹3K, ₹5K, ₹10K/day)      | RED FLAG  |
| Proportionate deduction clause      | RED FLAG  |

════════════════════════════════════════════════════════════════
PRE/POST HOSPITALIZATION RULES
════════════════════════════════════════════════════════════════

| Type                | GREAT          | GOOD        |
|---------------------|----------------|-------------|
| Pre-hospitalization | ≥60 days       | 30-59 days  |
| Post-hospitalization| ≥180 days      | 60-179 days |

════════════════════════════════════════════════════════════════
GREAT FEATURES (Better than market)
════════════════════════════════════════════════════════════════

- Room rent: "At Actuals" / "No limit" / "Any room"
- PED waiting: <24 months
- Specific illness waiting: <24 months
- Initial waiting: 0 days
- Pre-hospitalization: ≥60 days
- Post-hospitalization: ≥180 days
- Restore/Reset: Unlimited OR same illness covered
- Consumables: Fully covered without sub-limit
- Coverage multipliers: 2X / 3X / 4X from day 1
- Automatic sum insured increase regardless of claims
- Air ambulance covered
- No co-pay at any age
- No geography-based co-pay
- Worldwide emergency cover
- Waiting period reduces on renewal
- Lifelong renewal guaranteed
- No claim bonus >50% per year

════════════════════════════════════════════════════════════════
GOOD FEATURES (Market standard)
════════════════════════════════════════════════════════════════

- Room rent: Single Private AC room
- PED waiting: 24-48 months (including 36 months)
- Specific illness waiting: 24 months
- Initial waiting: 30 days
- Pre-hospitalization: 30-59 days
- Post-hospitalization: 60-179 days
- Restore: For different illness only
- Co-pay: 10-20% for age 60+ only (age-based)
- AYUSH treatment covered
- Day care procedures covered
- Domiciliary hospitalization covered
- Road ambulance covered
- Health check-up benefit
- Organ donor expenses covered
- Daily cash for shared room (BONUS - any amount)
- Cashless network available
- Optional add-ons available
- Voluntary deductible with premium discount
- Portability option
- E-opinion/second opinion

════════════════════════════════════════════════════════════════
RED FLAGS (Worse than market) - MUST BE SPECIFIC
════════════════════════════════════════════════════════════════

- Room rent: Daily cap in rupees (₹3K, ₹5K, ₹10K/day)
- Room rent: Proportionate deduction clause
- PED waiting: >48 months
- Specific illness waiting: >24 months
- Initial waiting: >30 days
- Mandatory co-pay for ALL ages (not just seniors)
- Disease-wise sub-limits (name the exact disease and limit)
- Specific non-standard exclusions (name them exactly)
- No restore/reset benefit at all
- Consumables not covered at all
- PPN/Network restriction with mandatory co-pay penalty
- Pre-hospitalization: <30 days
- Post-hospitalization: <60 days

IMPORTANT: 
- You MUST name the SPECIFIC issue
- "Multiple exclusions" is NOT a valid red flag
- Proportionate deduction MUST be flagged if present

════════════════════════════════════════════════════════════════
UNCLEAR (Only genuinely vague items)
════════════════════════════════════════════════════════════════

Flag as UNCLEAR only if:
- Conflicting statements in the policy
- Important benefit mentioned without any details
- "As per company discretion" without criteria
- Non-standard exclusions exist but specifics not clear

DO NOT flag as UNCLEAR:
- Standard waiting periods
- Clear room rent terms
- Add-on covers with listed names/prices
- Voluntary deductible options

════════════════════════════════════════════════════════════════
STANDARD IRDAI EXCLUSIONS - NEVER MENTION
════════════════════════════════════════════════════════════════

Every policy has these. Do not flag or mention:
Cosmetic surgery, Obesity treatment, Infertility, Maternity (if not in base), 
Dental (non-accident), Spectacles, Vitamins/tonics, Self-inflicted injuries, 
War/terrorism, Hazardous sports, Alcohol/drug abuse, Experimental treatments, 
Preventive vaccination, Rest cures, Gender change, Refractive error, 
External congenital conditions

════════════════════════════════════════════════════════════════
BONUS BENEFITS - ALWAYS POSITIVE
════════════════════════════════════════════════════════════════

These GIVE extra value = GOOD or GREAT, never red flags:
- Daily cash for shared room (any amount)
- Health check-up allowance
- Ambulance charges
- Wellness vouchers/program
- E-opinion/second opinion
- Convalescence benefit

════════════════════════════════════════════════════════════════
MUST-INCLUDE FEATURES
════════════════════════════════════════════════════════════════

Always analyze and include these if present in policy:
- Room rent terms
- PED waiting period
- Specific illness waiting period
- Initial waiting period
- Pre and Post hospitalization coverage
- Restore/Reset benefit
- Cashless network
- Co-pay terms (if any)
- Proportionate deduction (if any)

════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
════════════════════════════════════════════════════════════════

1. GREAT: 5-10 meaningful features
2. GOOD: 5-10 meaningful features
3. RED FLAGS: All genuine issues (be SPECIFIC, no vague flags)
4. UNCLEAR: Only genuinely vague items

For each feature:
- name: Clear feature name
- quote: Exact text from policy (short, <100 chars)
- reference: Section or page reference
- explanation: 1-2 sentences using "you/your" language

Summary counts MUST match actual features listed.

════════════════════════════════════════════════════════════════
FINAL CHECKLIST - VERIFY BEFORE SUBMITTING
════════════════════════════════════════════════════════════════

✓ 24-month specific illness is in GOOD (not red flags)
✓ 36-month PED is in GOOD (not red flags)  
✓ No "multiple exclusions" in red flags
✓ No standard IRDAI exclusions mentioned
✓ No bonus benefits in red flags
✓ Pre/Post ≥60/180 days is in GREAT (not good)
✓ Proportionate deduction IS in red flags (if present in policy)
✓ Room rent daily cap IS in red flags (if present in policy)
✓ All red flags are SPECIFIC
✓ Summary counts match actual features

If any of the above is wrong, your analysis is INCORRECT.`;

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
              content: `Analyze this Indian health insurance policy.

CRITICAL RULES:
- 24-month specific illness waiting = GOOD (not red flag)
- 36-month PED waiting = GOOD (not red flag)
- Proportionate deduction clause = RED FLAG (must flag if present)
- "Multiple exclusions" = DO NOT FLAG (not allowed)
- Daily cash for shared room = GOOD (bonus benefit)
- Pre/Post hospitalization ≥60/180 days = GREAT

Policy Document:
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
