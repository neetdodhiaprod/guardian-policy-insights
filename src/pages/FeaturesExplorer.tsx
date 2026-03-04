import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Feature = {
  pdf: string;
  clause_id: number;
  page: number;
  type: string;
  name: string;
  quote: string;
  reference: string | null;
  notes?: string;
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function FeaturesExplorer() {
  const [q, setQ] = useState("");
  const [pdf, setPdf] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const meta = useQuery({
    queryKey: ["features-meta"],
    queryFn: () => getJson<{ total: number; pdfs: string[]; types: string[] }>("/api/features/meta"),
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (pdf) params.set("pdf", pdf);
    if (type) params.set("type", type);
    params.set("offset", String(offset));
    params.set("limit", String(limit));
    return params.toString();
  }, [q, pdf, type, offset]);

  const rows = useQuery({
    queryKey: ["features", q, pdf, type, offset],
    queryFn: () =>
      getJson<{ total: number; offset: number; limit: number; items: Feature[] }>(
        `/api/features?${queryString}`
      ),
    enabled: meta.isSuccess,
  });

  const total = rows.data?.total ?? 0;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="container mx-auto max-w-6xl p-6 space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Features Explorer</h1>
        <p className="text-sm text-muted-foreground">
          Search extracted features across completed PDFs (updates as Pass 2 continues).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <div className="space-y-1">
          <label className="text-sm font-medium">Search</label>
          <Input
            value={q}
            onChange={(e) => {
              setOffset(0);
              setQ(e.target.value);
            }}
            placeholder="e.g., waiting period, proportionate deduction, room rent"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">PDF</label>
          <Select
            value={pdf || "__all"}
            onValueChange={(v) => {
              setOffset(0);
              setPdf(v === "__all" ? "" : v);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="All PDFs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All PDFs</SelectItem>
              {(meta.data?.pdfs ?? []).map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Type</label>
          <Select
            value={type || "__all"}
            onValueChange={(v) => {
              setOffset(0);
              setType(v === "__all" ? "" : v);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All types</SelectItem>
              {(meta.data?.types ?? []).map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {rows.isLoading ? "Loading…" : `${total.toLocaleString()} matches`} • Page {page}/{pages}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - limit))}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            disabled={offset + limit >= total}
            onClick={() => setOffset((o) => o + limit)}
          >
            Next
          </Button>
        </div>
      </div>

      {rows.isError ? (
        <div className="text-sm text-red-600 whitespace-pre-wrap">
          {(rows.error as Error).message}
        </div>
      ) : (
        <div className="overflow-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 w-[220px]">PDF</th>
                <th className="text-left p-2 w-[120px]">Type</th>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2 w-[70px]">Page</th>
              </tr>
            </thead>
            <tbody>
              {(rows.data?.items ?? []).map((r, idx) => (
                <tr key={`${r.pdf}-${r.clause_id}-${idx}`} className="border-t align-top">
                  <td className="p-2 font-mono text-xs">{r.pdf}</td>
                  <td className="p-2">{r.type}</td>
                  <td className="p-2">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-muted-foreground mt-1 whitespace-pre-wrap">{r.quote}</div>
                    {r.notes ? (
                      <div className="text-muted-foreground mt-1 italic whitespace-pre-wrap">
                        {r.notes}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-2">{r.page}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
