import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

const systemPrompt = `You are a health insurance policy analysis expert specializing in evaluating Indian health insurance policies for consumers.

CATEGORIZATION FRAMEWORK - STRICT RULES:

🟩 GREAT (Best-in-class) - Only use for features BETTER than industry standard:
- No room rent limit / any room allowed
- PED waiting period < 24 months (less than 2 years)
- Specific illness waiting < 24 months (less than 2 years)
- No initial waiting period (0 days)
- Maternity waiting ≤ 9 months with coverage ≥ ₹75,000
- Restore benefit works for same illness (not just unrelated)
- Consumables/non-medical expenses fully covered
- Pre-hospitalization ≥ 60 days
- Post-hospitalization ≥ 180 days
- 0% co-pay for ALL ages including senior citizens
- No zone-based restrictions
- Cashless network > 10,000 hospitals
- Modern treatments covered without sub-limits

🟨 GOOD (Industry standard) - Use for features that meet normal market standards:
- PED waiting 24-48 months (2-4 years) — THIS IS STANDARD, NOT BAD
- Specific illness waiting 24 months (2 years) — THIS IS STANDARD, NOT BAD
- Initial waiting period 30 days — THIS IS STANDARD, NOT BAD
- Single AC private room (with reasonable limit)
- 7,000-10,000 cashless hospitals
- Co-pay 10-20% ONLY for members aged 60+ years
- Maternity coverage ₹25,000-₹74,999
- Pre-hospitalization 30-59 days
- Post-hospitalization 60-179 days
- Restore benefit for unrelated illness only

🟥 BAD (Red flags) - ONLY use for features WORSE than industry standard:
- Room rent cap (any daily limit like ₹3,000-₹6,000/day)
- Proportionate deduction clause
- PED waiting > 48 months (more than 4 years)
- Specific illness waiting > 24 months (more than 2 years)
- Initial waiting > 30 days
- Maternity completely excluded from policy — THIS IS A RED FLAG
- Maternity waiting > 36 months
- Co-pay > 20% for any age group
- Mandatory co-pay for ALL ages (not just seniors)
- Zone-based co-pay penalties
- Cashless network < 7,000 hospitals
- No restore benefit at all
- Disease-specific permanent exclusions beyond IRDAI standard list

🟡 NEEDS CLARIFICATION - Use when information is missing or unclear:
- Critical feature not mentioned in document
- Vague or ambiguous language that could be interpreted multiple ways
- Conflicting statements about the same feature
- Coverage limits mentioned without specific amounts

DO NOT flag these as "Needs Clarification":
- Premium amounts / pricing — we analyze features, not cost
- Sum insured options — user already knows their coverage amount
- List of documents required for claims — operational, not a feature
- Claim settlement process — operational, not a feature
- Policy issuance details — administrative, not a feature

⚠️ CRITICAL RULES - FOLLOW EXACTLY:
1. 36-month PED waiting = GOOD (this is 3 years, which is standard in India)
2. 48-month PED waiting = GOOD (this is 4 years, still within acceptable range)
3. 24-month specific illness waiting = GOOD (this is the industry standard)
4. 30-day initial waiting = GOOD (this is the IRDAI standard)
5. ONLY flag PED as BAD if it exceeds 48 months (4 years)
6. ONLY flag specific illness as BAD if it exceeds 24 months (2 years)
7. Maternity NOT COVERED = BAD (red flag)
8. Maternity covered with long waiting = Check the waiting period

DO NOT mark industry-standard features as red flags. Indian health insurance typically has 3-4 year PED waiting periods - this is normal and expected.

RULES:
1. Show ALL bad features - never skip any red flag
2. Show top 5-7 great features
3. Show top 3-5 good features  
4. Show all items needing clarification
5. Only flag exclusions BEYOND standard IRDAI exclusions
6. Use professional English but explain terms simply
7. Include exact quotes from the document with page/section references

After analyzing, use the submit_policy_analysis tool to submit your structured findings.`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { policyText } = await req.json();

    if (!policyText || policyText.trim().length < 100) {
      throw new Error('Policy text is too short or empty');
    }

    console.log(`Analyzing policy text (${policyText.length} characters)`);

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      console.error('ANTHROPIC_API_KEY not configured');
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    console.log('Calling Claude API with tools...');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        system: systemPrompt,
        tools: [policyAnalysisTool],
        tool_choice: { type: "tool", name: "submit_policy_analysis" },
        messages: [
          {
            role: 'user',
            content: `Analyze this health insurance policy document thoroughly and submit your analysis using the submit_policy_analysis tool:\n\n${policyText}`
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', response.status, errorText);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Claude response received, extracting tool use...');

    // Extract tool use response
    const toolUse = data.content?.find((block: any) => block.type === 'tool_use');
    
    if (!toolUse || toolUse.type !== 'tool_use') {
      console.error('No tool use in response:', data.content);
      throw new Error('Invalid response format from AI');
    }

    console.log('Analysis complete:', {
      policyName: toolUse.input.policyName,
      insurer: toolUse.input.insurer,
    });

    return new Response(JSON.stringify(toolUse.input), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in analyze-policy function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to analyze policy';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
