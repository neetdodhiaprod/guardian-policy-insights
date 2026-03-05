import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type Item = {
  name: string;
  quote: string;
  reference: string;
  explanation: string;
};

type OutData = {
  GREAT?: Item[];
  GOOD?: Item[];
  BAD?: Item[];
  UNCLEAR?: Item[];
  disclaimer?: string;
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function Bucket({ title, items }: { title: string; items: Item[] }) {
  const [expanded, setExpanded] = useState(false);
  const CORE_MAX = 5;
  const NICE_MAX = 3;
  const COLLAPSED_MAX = CORE_MAX + NICE_MAX;

  const visible = expanded ? items : items.slice(0, COLLAPSED_MAX);
  const remaining = Math.max(0, items.length - visible.length);

  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="text-lg font-semibold">{title}</div>
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground">No items</div>
      ) : (
        <div className="space-y-3">
          {visible.map((it, idx) => (
            <div key={`${title}-${idx}`} className="border rounded-md p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="font-medium">{it.name}</div>
                <div className="text-[11px] px-2 py-1 rounded bg-muted">
                  {idx < CORE_MAX ? "Core" : "Nice-to-have"}
                </div>
              </div>

              <div className="text-sm mt-2 whitespace-pre-wrap">{it.explanation}</div>

              <details className="mt-2">
                <summary className="text-sm cursor-pointer text-muted-foreground">Read the clause</summary>
                <div className="text-xs text-muted-foreground mt-2">Reference: {it.reference}</div>
                <div className="text-sm mt-2 whitespace-pre-wrap">{it.quote}</div>
              </details>
            </div>
          ))}

          {!expanded && remaining > 0 ? (
            <Button variant="outline" onClick={() => setExpanded(true)}>
              Show more ({remaining})
            </Button>
          ) : expanded && items.length > COLLAPSED_MAX ? (
            <Button variant="outline" onClick={() => setExpanded(false)}>
              Show less
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function OutBrowser() {
  const [insurer, setInsurer] = useState<string>("");
  const [policy, setPolicy] = useState<string>("");

  const meta = useQuery({
    queryKey: ["out-meta"],
    queryFn: () => getJson<{ insurers: string[]; policiesByInsurer: Record<string, string[]> }>("/api/out/meta"),
  });

  const policies = useMemo(() => {
    if (!insurer) return [];
    return meta.data?.policiesByInsurer?.[insurer] ?? [];
  }, [meta.data, insurer]);

  const data = useQuery({
    queryKey: ["out", insurer, policy],
    queryFn: () => getJson<{ insurer: string; policy: string; data: OutData }>(`/api/out?insurer=${encodeURIComponent(insurer)}&policy=${encodeURIComponent(policy)}`),
    enabled: !!insurer && !!policy,
  });

  const buckets = useMemo(() => {
    const d = data.data?.data ?? {};
    return {
      GREAT: Array.isArray(d.GREAT) ? d.GREAT : [],
      GOOD: Array.isArray(d.GOOD) ? d.GOOD : [],
      BAD: Array.isArray(d.BAD) ? d.BAD : [],
      UNCLEAR: Array.isArray(d.UNCLEAR) ? d.UNCLEAR : [],
      disclaimer: d.disclaimer,
    };
  }, [data.data]);

  return (
    <div className="container mx-auto max-w-6xl p-6 space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Policy Outputs</h1>
        <p className="text-sm text-muted-foreground">Browse generated out/*.json results by insurer and policy.</p>
      </div>

      <div className="flex gap-3 items-end flex-wrap">
        <div className="space-y-1">
          <label className="text-sm font-medium">Insurer</label>
          <Select
            value={insurer || "__none"}
            onValueChange={(v) => {
              const next = v === "__none" ? "" : v;
              setInsurer(next);
              setPolicy("");
            }}
          >
            <SelectTrigger className="w-[320px]">
              <SelectValue placeholder="Select insurer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Select…</SelectItem>
              {(meta.data?.insurers ?? []).map((i) => (
                <SelectItem key={i} value={i}>
                  {i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Policy</label>
          <Select
            value={policy || "__none"}
            onValueChange={(v) => setPolicy(v === "__none" ? "" : v)}
            disabled={!insurer}
          >
            <SelectTrigger className="w-[420px]">
              <SelectValue placeholder={insurer ? "Select policy" : "Pick insurer first"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Select…</SelectItem>
              {policies.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" disabled={!insurer || !policy} onClick={() => data.refetch()}>
          Refresh
        </Button>
      </div>

      {meta.isError ? (
        <div className="text-sm text-red-600 whitespace-pre-wrap">{(meta.error as Error).message}</div>
      ) : null}

      {data.isError ? (
        <div className="text-sm text-red-600 whitespace-pre-wrap">{(data.error as Error).message}</div>
      ) : null}

      {!insurer || !policy ? (
        <div className="text-sm text-muted-foreground">Select an insurer and policy to view results.</div>
      ) : data.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Bucket title="GREAT" items={buckets.GREAT} />
          <Bucket title="GOOD" items={buckets.GOOD} />
          <Bucket title="BAD" items={buckets.BAD} />
          <Bucket title="UNCLEAR" items={buckets.UNCLEAR} />

          {buckets.disclaimer ? (
            <div className="md:col-span-2 text-xs text-muted-foreground border rounded-lg p-3 whitespace-pre-wrap">
              {buckets.disclaimer}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
