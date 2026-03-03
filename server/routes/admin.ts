import { Router } from 'express';
import { getDb } from '../db';

export const adminRouter = Router();

adminRouter.get('/variants', async (_req, res) => {
  const db = await getDb();
  const items = await db
    .collection('policy_variants')
    .find({}, { projection: { _id: 0, metadata: 1, status: 1 } })
    .sort({ 'metadata.insurerKey': 1, 'metadata.productName': 1, 'metadata.variantName': 1 })
    .toArray();
  res.json({ items });
});

adminRouter.get('/variants/:planVariantId', async (req, res) => {
  const db = await getDb();
  const { planVariantId } = req.params;
  const item = await db
    .collection('policy_variants')
    .findOne({ 'metadata.planVariantId': planVariantId }, { projection: { _id: 0 } });
  res.json({ item });
});

adminRouter.post('/variants/:planVariantId', async (req, res) => {
  const db = await getDb();
  const { planVariantId } = req.params;
  const body = req.body;

  if (!body?.metadata || body?.metadata?.planVariantId !== planVariantId) {
    return res.status(400).json({ error: 'invalid_payload' });
  }

  const now = new Date().toISOString();
  body.metadata.updatedAt = now;

  await db.collection('policy_variants').updateOne(
    { 'metadata.planVariantId': planVariantId },
    { $set: body, $setOnInsert: { createdAt: now } },
    { upsert: true }
  );

  await db.collection('policy_variant_audit').insertOne({
    planVariantId,
    at: now,
    action: 'save',
    snapshot: body,
  });

  res.json({ ok: true });
});

adminRouter.post('/variants/:planVariantId/approve', async (req, res) => {
  const db = await getDb();
  const { planVariantId } = req.params;
  const now = new Date().toISOString();

  const result = await db.collection('policy_variants').updateOne(
    { 'metadata.planVariantId': planVariantId },
    { $set: { status: 'approved', 'metadata.updatedAt': now } }
  );

  await db.collection('policy_variant_audit').insertOne({
    planVariantId,
    at: now,
    action: 'approve',
  });

  res.json({ ok: true, matched: result.matchedCount });
});
