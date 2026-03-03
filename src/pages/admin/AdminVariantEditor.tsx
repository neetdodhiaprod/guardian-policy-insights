import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { approveVariant, getAdminKey, getVariant, PolicyTakeItem, PolicyVariantRecord, saveVariant } from '@/lib/adminApi';

function emptyRecord(planVariantId: string): PolicyVariantRecord {
  return {
    metadata: {
      planVariantId,
      insurerKey: '',
      insurerDisplayName: '',
      productName: '',
      variantName: '',
      sourcePdfPath: '',
    },
    guardianTake: {
      great: [],
      good: [],
      redFlags: [],
      needsClarification: [],
    },
    status: 'draft',
  };
}

function ItemEditor({ item, onChange, onRemove }: { item: PolicyTakeItem; onChange: (v: PolicyTakeItem) => void; onRemove: () => void }) {
  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Input value={item.name} placeholder="Name" onChange={(e) => onChange({ ...item, name: e.target.value })} />
        <Button variant="outline" onClick={onRemove}>Remove</Button>
      </div>
      <Textarea value={item.quote} placeholder="Quote" onChange={(e) => onChange({ ...item, quote: e.target.value })} />
      <Input value={item.reference} placeholder="Reference (page/section)" onChange={(e) => onChange({ ...item, reference: e.target.value })} />
      <Textarea value={item.explanation} placeholder="Explanation" onChange={(e) => onChange({ ...item, explanation: e.target.value })} />
    </div>
  );
}

function Section({ title, items, setItems }: { title: string; items: PolicyTakeItem[]; setItems: (v: PolicyTakeItem[]) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="secondary"
          onClick={() => setItems([...items, { name: '', quote: '', reference: '', explanation: '' }])}
        >
          Add item
        </Button>
        <div className="space-y-3">
          {items.map((it, idx) => (
            <ItemEditor
              key={idx}
              item={it}
              onChange={(v) => setItems(items.map((x, i) => (i === idx ? v : x)))}
              onRemove={() => setItems(items.filter((_, i) => i !== idx))}
            />
          ))}
          {items.length === 0 && <div className="text-sm text-muted-foreground">No items yet.</div>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminVariantEditor() {
  const { planVariantId } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState<PolicyVariantRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!getAdminKey()) {
      navigate('/admin/login');
      return;
    }

    (async () => {
      if (!planVariantId) return;
      try {
        const res = await getVariant(planVariantId);
        setRecord(res.item || emptyRecord(planVariantId));
      } catch (e: any) {
        setError(e?.message || 'Failed to load');
      }
    })();
  }, [planVariantId, navigate]);

  const title = useMemo(() => {
    if (!record) return planVariantId;
    const m = record.metadata;
    return `${m.insurerDisplayName || 'Insurer'} — ${m.productName || 'Product'} — ${m.variantName || 'Variant'}`;
  }, [record, planVariantId]);

  if (!record) return <div className="p-6">Loading…</div>;

  const m = record.metadata;

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm text-muted-foreground"><Link to="/admin">← Back</Link></div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <div className="text-xs text-muted-foreground">{m.planVariantId} • status: {record.status}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={async () => {
              setSaving(true);
              setError(null);
              try {
                await saveVariant(m.planVariantId, record);
              } catch (e: any) {
                setError(e?.message || 'Save failed');
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              setSaving(true);
              setError(null);
              try {
                await approveVariant(m.planVariantId);
                navigate('/admin');
              } catch (e: any) {
                setError(e?.message || 'Approve failed');
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
          >
            Approve
          </Button>
        </div>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Metadata</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input value={m.insurerKey} placeholder="insurerKey" onChange={(e) => setRecord({ ...record, metadata: { ...m, insurerKey: e.target.value } })} />
          <Input value={m.insurerDisplayName} placeholder="insurerDisplayName" onChange={(e) => setRecord({ ...record, metadata: { ...m, insurerDisplayName: e.target.value } })} />
          <Input value={m.productName} placeholder="productName" onChange={(e) => setRecord({ ...record, metadata: { ...m, productName: e.target.value } })} />
          <Input value={m.variantName} placeholder="variantName" onChange={(e) => setRecord({ ...record, metadata: { ...m, variantName: e.target.value } })} />
          <Input value={m.sourcePdfPath || ''} placeholder="sourcePdfPath" onChange={(e) => setRecord({ ...record, metadata: { ...m, sourcePdfPath: e.target.value } })} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6">
        <Section title="Great" items={record.guardianTake.great} setItems={(v) => setRecord({ ...record, guardianTake: { ...record.guardianTake, great: v } })} />
        <Section title="Good" items={record.guardianTake.good} setItems={(v) => setRecord({ ...record, guardianTake: { ...record.guardianTake, good: v } })} />
        <Section title="Red Flags" items={record.guardianTake.redFlags} setItems={(v) => setRecord({ ...record, guardianTake: { ...record.guardianTake, redFlags: v } })} />
        <Section title="Needs Clarification" items={record.guardianTake.needsClarification} setItems={(v) => setRecord({ ...record, guardianTake: { ...record.guardianTake, needsClarification: v } })} />
      </div>
    </div>
  );
}
