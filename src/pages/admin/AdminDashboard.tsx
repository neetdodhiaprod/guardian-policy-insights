import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { clearAdminKey, getAdminKey, listVariants } from '@/lib/adminApi';

export default function AdminDashboard() {
  const [items, setItems] = useState<Array<any>>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!getAdminKey()) {
      navigate('/admin/login');
      return;
    }

    (async () => {
      try {
        const res = await listVariants();
        setItems(res.items);
      } catch (e: any) {
        setError(e?.message || 'Failed to load');
      }
    })();
  }, [navigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((x) => {
      const m = x.metadata;
      return (
        (m.planVariantId || '').toLowerCase().includes(q) ||
        (m.insurerDisplayName || '').toLowerCase().includes(q) ||
        (m.productName || '').toLowerCase().includes(q) ||
        (m.variantName || '').toLowerCase().includes(q)
      );
    });
  }, [items, query]);

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              clearAdminKey();
              navigate('/admin/login');
            }}
          >
            Log out
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Policy Variants</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Search insurer / product / variant / id" value={query} onChange={(e) => setQuery(e.target.value)} />
          {error && <div className="text-sm text-destructive">{error}</div>}

          <div className="space-y-2">
            {filtered.map((x) => (
              <div key={x.metadata.planVariantId} className="border rounded-md p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {x.metadata.insurerDisplayName} — {x.metadata.productName} — {x.metadata.variantName}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{x.metadata.planVariantId} • status: {x.status}</div>
                </div>
                <Button asChild variant="secondary">
                  <Link to={`/admin/variants/${encodeURIComponent(x.metadata.planVariantId)}`}>Edit</Link>
                </Button>
              </div>
            ))}
            {filtered.length === 0 && <div className="text-sm text-muted-foreground">No variants found.</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
