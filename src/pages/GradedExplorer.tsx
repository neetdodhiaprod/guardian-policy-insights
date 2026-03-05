import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type GradedItem = {
  name: string;
  quote: string;
  reference: string;
  explanation: string;
};

type BasicsItem = {
  category: string;
  verdict: "GREAT" | "GOOD" | "BAD" | "UNKNOWN" | string;
  name: string;
  quote: string;
  reference: string;
  explanation: string;
};

type GradedData = {
  BASICS?: BasicsItem[];
  GREAT?: GradedItem[];
  GOOD?: GradedItem[];
  BAD?: GradedItem[];
  UNCLEAR?: GradedItem[];
  disclaimer?: string;
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function Bucket({ title, items }: { title: string; items: GradedItem[] }) {
  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="text-lg font-semibold">{title}</div>
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground">No items</div>
      ) : (
        <div className="space-y-3">
          {items.map((it, idx) => (
            <div key={`${title}-${idx}`} className="border rounded-md p-3">
              <div className="font-medium">{it.name}</div>
              <div className="text-xs text-muted-foreground mt-1">Ref: {it.reference}</div>
              <div className="text-sm mt-2 whitespace-pre-wrap">{it.explanation}</div>
              <details className="mt-2">
                <summary className="text-sm cursor-pointer text-muted-foreground">Show source text</summary>
                <div className="text-sm mt-2 whitespace-pre-wrap">{it.quote}</div>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GradedExplorer() {
  const [pdf, setPdf] = useState<string>("");

  const meta = useQuery({
    queryKey: ["graded-meta"],
    queryFn: () => getJson<{ total: number; pdfs: string[] }>("/api/graded/meta"),
  });

  const graded = useQuery({
    queryKey: ["graded", pdf],
    queryFn: () => getJson<{ pdf: string; data: GradedData }>(`/api/graded?pdf=${encodeURIComponent(pdf)}`),
    enabled: !!pdf,
  });

  const data = graded.data?.data;

  const buckets = useMemo(() => {
    const d = data ?? {};
    return {
      GREAT: Array.isArray(d.GREAT) ? d.GREAT : [],
      GOOD: Array.isArray(d.GOOD) ? d.GOOD : [],
      BAD: Array.isArray(d.BAD) ? d.BAD : [],
      UNCLEAR: Array.isArray(d.UNCLEAR) ? d.UNCLEAR : [],
    };
  }, [data]);

  const basics = useMemo(() => (Array.isArray(data?.BASICS) ? data!.BASICS! : []), [data]);

  return (
    <div className="container mx-auto max-w-6xl p-6 space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Policy Summary (Graded Output)</h1>
        <p className="text-sm text-muted-foreground">Customer-style view: BASICS checklist + Great/Good/Bad/Unclear buckets.</p>
      </div>

      <div className="flex gap-3 items-end flex-wrap">
        <div className="space-y-1">
          <label className="text-sm font-medium">Policy PDF</label>
          <Select
            value={pdf || "__none"}
            onValueChange={(v) => setPdf(v === "__none" ? "" : v)}
          >
            <SelectTrigger className="w-[360px]">
              <SelectValue placeholder="Select a graded PDF" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Select…</SelectItem>
              {(meta.data?.pdfs ?? []).map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" disabled={!pdf} onClick={() => graded.refetch()}>
          Refresh
        </Button>
      </div>

      {meta.isError ? (
        <div className="text-sm text-red-600 whitespace-pre-wrap">{(meta.error as Error).message}</div>
      ) : null}

      {graded.isError ? (
        <div className="text-sm text-red-600 whitespace-pre-wrap">{(graded.error as Error).message}</div>
      ) : null}

      {!pdf ? (
        <div className="text-sm text-muted-foreground">Pick a policy to view its graded output.</div>
      ) : graded.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <div className="text-lg font-semibold mb-2">BASICS checklist</div>
            {basics.length === 0 ? (
              <div className="text-sm text-muted-foreground">No BASICS found in this graded file.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {basics.map((b, idx) => (
                  <div key={`${b.category}-${idx}`} className="border rounded-md p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{b.category}</div>
                      <div className="text-xs px-2 py-1 rounded bg-muted">{b.verdict}</div>
                    </div>
                    <div className="text-sm mt-1">{b.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">Ref: {b.reference}</div>
                    <div className="text-sm mt-2 whitespace-pre-wrap">{b.explanation}</div>
                    {b.quote ? (
                      <details className="mt-2">
                        <summary className="text-sm cursor-pointer text-muted-foreground">Show source text</summary>
                        <div className="text-sm mt-2 whitespace-pre-wrap">{b.quote}</div>
                      </details>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Bucket title="GREAT" items={buckets.GREAT} />
            <Bucket title="GOOD" items={buckets.GOOD} />
            <Bucket title="BAD (Red flags)" items={buckets.BAD} />
            <Bucket title="UNCLEAR" items={buckets.UNCLEAR} />
          </div>

          {data?.disclaimer ? (
            <div className="text-xs text-muted-foreground border rounded-lg p-3 whitespace-pre-wrap">{data.disclaimer}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
