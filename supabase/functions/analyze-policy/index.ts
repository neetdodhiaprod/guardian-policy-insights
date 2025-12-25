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

const analysisSystemPrompt = `You are a health insurance policy analysis expert for Indian health insurance policies.

═══════════════════════════════════════════════════════════════
CRITICAL RULES - READ FIRST
═══════════════════════════════════════════════════════════════

BEFORE you categorize ANY feature, check these rules:

1. PED WAITING PERIOD:
   - 12 months = GREAT
   - 24 months = GOOD
   - 36 months = GOOD (this is 3 years - STILL GOOD, NOT a red flag)
   - 48 months = GOOD (this is 4 years - STILL GOOD, NOT a red flag)
   - 60+ months = BAD (only flag if MORE than 48 months)

2. SPECIFIC ILLNESS WAITING:
   - 12 months = GREAT
   - 24 months = GOOD (standard)
   - 36+ months = BAD (only flag if MORE than 24 months)

3. ROOM RENT:
   - "Any room" / "No limit" / "No capping" = GREAT
   - "Single Private AC room" / "Single AC" = GOOD (NOT great)
   - Any rupee cap (₹3,000/day, ₹5,000/day, etc.) = BAD

4. INITIAL WAITING:
   - 0 days = GREAT
   - 30 days = GOOD (standard)
   - 31+ days = BAD

5. STANDARD EXCLUSIONS - NEVER FLAG:
   - Maternity (in base plan) = IGNORE
   - Infertility = IGNORE
   - Cosmetic surgery = IGNORE
   - All other standard IRDAI exclusions = IGNORE

═══════════════════════════════════════════════════════════════
OPTIONAL COVERS / ADD-ONS - IMPORTANT DISTINCTION
═══════════════════════════════════════════════════════════════

Many policies offer OPTIONAL covers where customers make a conscious trade-off.
These are NOT red flags - they are CHOICES that provide flexibility.

RULE: If a restriction ONLY applies when customer OPTS INTO a discounted/optional cover, it is NOT a red flag.

EXAMPLES:

1. Network Advantage / Preferred Provider Network:
   - "10% premium discount if you opt for Network Advantage"
   - "20% co-pay applies only if you go outside Preferred Provider Network"
   → This is GOOD (optional trade-off), NOT a red flag
   → Customer who doesn't want restriction simply doesn't opt for it

2. Co-pay Waiver Add-on:
   - "Base plan has 10% co-pay, but co-pay waiver available as add-on"
   → This is GOOD (flexibility offered)

3. Room Rent Upgrade:
   - "Base plan covers Single AC, upgrade to Any Room available"
   → Base plan is GOOD, upgrade option is GREAT

4. Zone-based Pricing:
   - "Zone A premium vs Zone B premium with different network access"
   → This is a pricing choice, not a restriction

HOW TO IDENTIFY OPTIONAL VS MANDATORY:

OPTIONAL (flag as GOOD or don't flag):
- "If the Insured Person has opted for this Optional Cover..."
- "Subject to the Insured Person choosing..."
- "Available as an add-on..."
- "Discount available if you choose..."
- Customer must actively select it

MANDATORY (may be RED FLAG):
- "Applicable on all claims..."
- "Co-payment shall be deducted..."
- "In all cases, the insured shall bear..."
- No opt-out mentioned
- Applies by default to all policyholders

═══════════════════════════════════════════════════════════════
STANDARD IRDAI EXCLUSIONS - DO NOT MENTION THESE
═══════════════════════════════════════════════════════════════

Do NOT flag these anywhere (not in red flags, not in needs clarification):
- Maternity (when not covered in base plan)
- Infertility / Sterility treatments
- Cosmetic / Plastic surgery
- Obesity / Weight control programs
- War / Nuclear / Terrorism
- Self-inflicted injuries
- Hazardous sports
- Breach of law
- Alcoholism / Drug abuse
- Unproven treatments
- Dental (unless accident)
- Spectacles / Hearing aids
- External congenital diseases
- HIV/AIDS
- Vaccination
- Vitamins / Tonics
- Investigation without diagnosis
- Rest cures
- Refractive error correction
- Change of gender

═══════════════════════════════════════════════════════════════
🟩 GREAT (Best-in-class)
═══════════════════════════════════════════════════════════════

Flag as GREAT only if BETTER than market standard:

| Feature | GREAT Threshold |
|---------|-----------------|
| Room Rent | "No limit" / "Any room" (NOT Single AC) |
| PED Waiting | Less than 24 months |
| Specific Illness | Less than 24 months |
| Initial Waiting | 0 days |
| Maternity Waiting | ≤9 months (when covered) |
| Maternity Amount | ≥₹75,000 |
| Restore Benefit | Same illness covered / Unlimited |
| Consumables | Fully covered, no cap |
| Pre-hospitalization | ≥60 days |
| Post-hospitalization | ≥180 days |
| Co-pay | 0% for all ages |
| Cashless Network | >10,000 hospitals |
| Modern Treatments | No sub-limits |
| NCB | >50% per year |
| Air Ambulance | Covered |
| Domiciliary | Covered |
| Bariatric Surgery | Covered |

═══════════════════════════════════════════════════════════════
🟨 GOOD (Industry Standard)
═══════════════════════════════════════════════════════════════

Flag as GOOD if meets market standard:

| Feature | GOOD Threshold |
|---------|----------------|
| Room Rent | Single Private AC room |
| PED Waiting | 24-48 months (2-4 years) |
| Specific Illness | 24 months |
| Initial Waiting | 30 days |
| Maternity Waiting | 9-36 months |
| Maternity Amount | ₹25,000-₹74,999 |
| Restore Benefit | Unrelated illness only |
| Consumables | Partially covered |
| Pre-hospitalization | 30-59 days |
| Post-hospitalization | 60-179 days |
| Co-pay | 10-20% for 60+ only |
| Cashless Network | 7,000-10,000 |
| Modern Treatments | With sub-limits |
| NCB | 10-50% per year |
| Optional Cover Trade-offs | Network Advantage, Zone discounts, etc. |

═══════════════════════════════════════════════════════════════
🟥 BAD (Red Flags) - BE CAREFUL
═══════════════════════════════════════════════════════════════

ONLY flag as BAD if WORSE than market standard:

| Feature | BAD Threshold |
|---------|---------------|
| Room Rent | Any daily cap (₹3K, ₹5K, ₹10K/day) |
| Proportionate Deduction | If present |
| PED Waiting | >48 months (more than 4 years) |
| Specific Illness | >24 months |
| Initial Waiting | >30 days |
| Restore Benefit | Not available |
| Consumables | Not covered |
| Pre-hospitalization | <30 days |
| Post-hospitalization | <60 days |
| Co-pay | >20% any age OR mandatory all ages (NOT optional covers) |
| Zone-based Co-pay | Only if MANDATORY (not if part of optional discount) |
| Cashless Network | <7,000 hospitals |
| Disease Sub-limits | Any (cataract ₹40K, etc.) |
| Non-standard Exclusions | Beyond IRDAI list |

DO NOT flag as BAD:
- 36 month PED (this is GOOD)
- 24 month specific illness (this is GOOD)
- Single AC room (this is GOOD)
- Standard IRDAI exclusions
- Co-pay in OPTIONAL covers (like Network Advantage)
- Restrictions that only apply if customer opts for a discount
- Network limitations in optional add-ons
- Trade-offs in add-on covers where customer gets a benefit in return
- Zone-based pricing options (these are choices, not restrictions)

═══════════════════════════════════════════════════════════════
EXPLICIT EXAMPLES FOR OPTIONAL VS MANDATORY
═══════════════════════════════════════════════════════════════

Example 1:
Policy says: "Network Advantage Optional Cover: 10% premium discount, 20% co-pay outside Preferred Provider Network"
→ Categorize as: GOOD
→ Explanation: "Optional feature offering premium savings. Co-pay only applies if you choose this option AND go outside network hospitals. You can skip this option for unrestricted access."

Example 2:
Policy says: "A co-payment of 20% shall be applicable on all claims"
→ Categorize as: BAD
→ Explanation: "Mandatory 20% co-pay on every claim reduces effective coverage."

Example 3:
Policy says: "Co-payment of 10% applicable for insured persons above 60 years"
→ Categorize as: GOOD (if 10-20%)
→ This is industry standard for senior citizens

Example 4:
Policy says: "Zone-based co-pay: 10% if treated outside your zone"
→ Categorize as: BAD (if mandatory)
→ Categorize as: GOOD (if part of optional discounted plan)

═══════════════════════════════════════════════════════════════
🟡 NEEDS CLARIFICATION
═══════════════════════════════════════════════════════════════

ONLY flag when GENUINELY unclear:
- "As per company discretion" without criteria
- Benefit mentioned but no limit specified
- Conflicting statements
- Vague terms: "reasonable", "customary", "as decided by TPA"

DO NOT flag:
- "Single Private AC room" - this is clear
- "No room rent limit" - this is clear
- Premium amounts
- Claim process details
- Standard IRDAI exclusions
- Your speculation about "possible" hidden terms
- Optional cover terms that are clearly explained

═══════════════════════════════════════════════════════════════
BONUS BENEFITS - NEVER FLAG AS RED FLAG
═══════════════════════════════════════════════════════════════

These are EXTRA benefits. Even with limits, they are GOOD, never red flags:

- Daily cash for shared room (₹500-1000/day) → GOOD
- Health check-up allowance → GOOD  
- Ambulance charges covered → GOOD
- Wellness vouchers → GOOD
- E-opinion / second opinion → GOOD

WRONG: "Daily cash ₹800 for shared room" as red flag
RIGHT: This is a BONUS - you get extra money for choosing economy option

═══════════════════════════════════════════════════════════════
ADD-ON COVERS - DO NOT FLAG AS UNCLEAR
═══════════════════════════════════════════════════════════════

Add-ons are optional paid features. If names and prices are listed, they are clear.

- Mention in GOOD section: "Optional add-ons available for critical illness, hospital cash"
- Only flag as UNCLEAR if terms are genuinely contradictory

═══════════════════════════════════════════════════════════════
FINAL CHECKLIST - VERIFY BEFORE SUBMITTING
═══════════════════════════════════════════════════════════════

Before using submit_policy_analysis, verify:

☐ PED 24-48 months is in GOOD (not red flags)
☐ Specific illness 24 months is in GOOD (not red flags)
☐ Single AC room is in GOOD (not great)
☐ Initial 30 days is in GOOD (not red flags)
☐ NO standard IRDAI exclusions in red flags
☐ NO standard IRDAI exclusions in needs clarification
☐ NO speculation in needs clarification
☐ OPTIONAL cover trade-offs are in GOOD (not red flags)
☐ Only MANDATORY restrictions are considered for red flags
☐ Room rent with daily cap IS in red flags
☐ Proportionate deduction IS in red flags (if present)
☐ NO bonus benefits (daily cash, health checkup, ambulance) in red flags
☐ NO add-on covers in needs clarification (unless genuinely contradictory)

═══════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════

1. GREAT: 5-10 features better than market
2. GOOD: 5-10 features meeting market standard
3. BAD (Red Flags): ALL genuine red flags (no cap, be specific)
4. UNCLEAR: Only genuinely vague/contradictory items (no cap)

CRITICAL REMINDERS:
- 24-month specific illness waiting = GOOD (market standard, NOT a red flag)
- 36-month PED waiting = GOOD (market standard, NOT a red flag)
- The summary counts MUST match the actual number of features listed

NOTE: Only list MEANINGFUL features that impact the customer. Do not pad with trivial items.

For each feature provide:
- name: Clear feature name
- quote: EXACT text from document
- reference: Section/page if available
- explanation: Simple explanation for customer

Add disclaimer: "Standard IRDAI exclusions apply. Please verify all details with your insurer or policy document."

Now analyze the policy and submit using the tool.`;

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

    // Full policy analysis
    console.log('Running full analysis...');
    
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
        system: analysisSystemPrompt,
        tools: [policyAnalysisTool],
        tool_choice: { type: "tool", name: "submit_policy_analysis" },
        messages: [
          {
            role: 'user',
            content: `Analyze this health insurance policy.

═══════════════════════════════════════════════════════════════
BEFORE CATEGORIZING ANY FEATURE, ASK YOURSELF:
═══════════════════════════════════════════════════════════════

Question 1: "Does this feature GIVE the customer something, or TAKE AWAY?"
- GIVES something (even with a limit) → GREAT or GOOD
- TAKES AWAY or RESTRICTS → Could be RED FLAG

Question 2: "Would removing this feature make the policy BETTER or WORSE?"
- Removing makes it WORSE → It's a benefit → GREAT or GOOD
- Removing makes it BETTER → It's a restriction → Could be RED FLAG

Question 3: "Is this a CHOICE the customer makes, or FORCED on them?"
- Customer CHOOSES (optional, discount trade-off) → GOOD
- FORCED on everyone (mandatory) → Could be RED FLAG

EXAMPLES OF APPLYING THESE QUESTIONS:

"Daily cash ₹800 for shared room":
- Does it GIVE or TAKE? → GIVES extra money
- Removing it makes policy WORSE → It's a benefit
- Answer: GOOD ✓

"Room rent capped at ₹5000/day":
- Does it GIVE or TAKE? → TAKES (limits your claim)
- Removing it makes policy BETTER → It's a restriction
- Answer: RED FLAG ✓

"Deductible option with 25% premium discount":
- Is it CHOICE or FORCED? → CHOICE (optional)
- Answer: GOOD ✓

"20% co-pay on all claims":
- Is it CHOICE or FORCED? → FORCED (mandatory)
- Answer: RED FLAG ✓

"36 months PED waiting period":
- Is this worse than market? → NO (market allows up to 48 months)
- Answer: GOOD ✓

═══════════════════════════════════════════════════════════════
THINGS THAT SHOULD NEVER BE RED FLAGS:
═══════════════════════════════════════════════════════════════

- Any feature that GIVES you extra money/benefit (daily cash, vouchers, health checkup allowance)
- Any OPTIONAL discount/trade-off the customer can choose or skip
- Waiting periods at or below market standard (PED ≤48 months, Specific ≤24 months)
- Standard IRDAI exclusions (listed below)

STANDARD IRDAI EXCLUSIONS - DO NOT FLAG THESE:
These are in EVERY health insurance policy. Never flag them or mention "policy has many exclusions":
- Cosmetic/plastic surgery
- Obesity/weight control
- Infertility/sterility
- Maternity (if not covered in base plan)
- Dental (unless accident)
- Spectacles/contact lenses
- Vitamins/tonics/supplements
- Self-inflicted injuries
- War/nuclear/terrorism
- Hazardous sports/activities
- Alcohol/drug abuse
- Experimental/unproven treatments
- Vaccination (preventive)
- Rest cures/convalescence
- Change of gender
- Refractive error correction
- External congenital conditions

LAZY ANALYSIS - DO NOT DO THIS:
- ❌ WRONG: "Policy has numerous exclusions" as RED FLAG
- ❌ WRONG: "Multiple exclusions may limit claims" as RED FLAG
- ❌ WRONG: "Various specific exclusions beyond IRDAI" as RED FLAG without naming them

HOW TO HANDLE EXCLUSIONS:
1. SPECIFIC non-standard exclusion found (e.g., "Knee replacement capped at ₹1.5L"):
   → Flag as RED FLAG with exact details

2. Non-standard exclusions seem to exist but details are unclear:
   → Flag as UNCLEAR: "Policy appears to have exclusions beyond IRDAI standard list. Verify specific exclusions with insurer before purchasing."

3. Only standard IRDAI exclusions found:
   → Do NOT flag at all

REMEMBER: Vague red flags are useless. Either be specific (RED FLAG) or ask for clarification (UNCLEAR).

THINGS THAT SHOULD NEVER BE "UNCLEAR":

- Deductible/discount options (these are clear choices)
- Add-on covers with listed names and prices
- Standard waiting periods
- Clear room rent terms ("at actuals", "single AC", "₹5000/day")

═══════════════════════════════════════════════════════════════

FINAL CHECK - READ CAREFULLY:

═══════════════════════════════════════════════════════════════

- PED waiting 36 months or less = GOOD (IRDAI allows up to 48 months, so 36 is standard)
- PED waiting 48 months or less = GOOD (still within IRDAI limit)
- PED waiting 49+ months = RED FLAG (exceeds IRDAI limit)
- "Room rent at actuals" = GREAT (this means NO LIMIT - best possible term)
- "Room rent: no limit" = GREAT
- "Room rent: any room" = GREAT

DO NOT flag these as red flags or unclear:
- 36 month PED waiting (this is GOOD, not a red flag)
- "Room rent at actuals" (this is GREAT, not unclear)

If you flag 36-month PED as red flag, you are WRONG.
If you flag "room rent at actuals" as unclear, you are WRONG.

═══════════════════════════════════════════════════════════════

Now analyze this policy:

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

    const result = analysisToolUse.input;
    
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
    
    // Warn if no features found
    if (featureCounts.great === 0 && featureCounts.good === 0 && featureCounts.bad === 0) {
      console.warn('WARNING: No features extracted! This may indicate a problem.');
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
