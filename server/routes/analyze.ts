import { Router } from 'express';

export const analyzeRouter = Router();

analyzeRouter.post('/analyze-policy', async (req, res) => {
  const policyText: string | undefined = req.body?.policyText;
  if (!policyText || policyText.trim().length < 100) {
    return res.status(400).json({ error: 'Policy text is too short or empty' });
  }

  // MVP stub: return a deterministic response so FE can function without external AI keys.
  // TODO: replace with actual LLM call (Anthropic/OpenAI) + prompt.
  return res.json({
    policyName: 'Unknown (stub)',
    insurer: 'Unknown',
    sumInsured: 'Not specified',
    policyType: 'Not specified',
    documentType: 'Policy Wording',
    summary: { great: 0, good: 0, bad: 0, unclear: 1 },
    features: {
      great: [],
      good: [],
      bad: [],
      unclear: [
        {
          name: 'AI analysis not configured yet',
          quote: policyText.slice(0, 200),
          reference: 'N/A',
          explanation: 'This is a placeholder response. Next step is wiring an LLM provider and the long prompt into the Node API.',
        },
      ],
    },
    disclaimer: 'Prototype output. Do not treat as financial/medical advice.',
  });
});
