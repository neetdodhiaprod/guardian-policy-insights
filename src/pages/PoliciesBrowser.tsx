import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ThumbsUp, AlertTriangle, HelpCircle, X, Search, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import Header from "@/components/Header";
import SummaryCard from "@/components/SummaryCard";
import FeatureSection from "@/components/FeatureSection";
import { PolicyAnalysis } from "@/lib/mockData";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

type PolicyMeta = {
  id: string;
  policyName: string;
  policyType: string;
  summary: { great: number; good: number; bad: number; unclear: number };
};

type InsurerGroup = {
  id: string;
  label: string;
  policies: PolicyMeta[];
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function ScorePill({ count, type }: { count: number; type: keyof PolicyMeta["summary"] }) {
  const cfg = {
    great:   { cls: "bg-great/15 text-great",             icon: ShieldCheck },
    good:    { cls: "bg-good/20 text-good-foreground",    icon: ThumbsUp },
    bad:     { cls: "bg-bad/15 text-bad",                  icon: AlertTriangle },
    unclear: { cls: "bg-unclear/15 text-unclear",          icon: HelpCircle },
  }[type];
  const Icon = cfg.icon;
  if (count === 0) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>
      <Icon className="w-3 h-3" />
      {count}
    </span>
  );
}

function PolicyCard({ meta, onClick, active }: { meta: PolicyMeta; onClick: () => void; active: boolean }) {
  const redFlags = meta.summary.bad;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-4 transition-all duration-150 hover:shadow-md hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active ? "border-primary bg-primary/5 shadow-md" : "border-border bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="font-semibold text-sm text-foreground leading-snug">{meta.policyName}</p>
        <ChevronRight className={`w-4 h-4 flex-shrink-0 mt-0.5 transition-transform ${active ? "rotate-90 text-primary" : "text-muted-foreground"}`} />
      </div>
      {meta.policyType && meta.policyType !== "Not specified" && (
        <p className="text-xs text-muted-foreground mb-2">{meta.policyType}</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        <ScorePill count={meta.summary.great}   type="great" />
        <ScorePill count={meta.summary.good}    type="good" />
        {redFlags > 0 && <ScorePill count={redFlags} type="bad" />}
        <ScorePill count={meta.summary.unclear} type="unclear" />
      </div>
    </button>
  );
}

function DetailPanel({
  insurer,
  policy,
  onClose,
}: {
  insurer: string;
  policy: PolicyMeta;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useQuery<PolicyAnalysis>({
    queryKey: ["policy", insurer, policy.id],
    queryFn: () => getJson(`${API}/api/policies/${insurer}/${policy.id}`),
  });

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card sticky top-0 z-10">
        <p className="font-semibold text-foreground truncate pr-4">{policy.policyName}</p>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {isLoading && (
          <div className="flex items-center justify-center py-20 text-muted-foreground text-sm animate-pulse">
            Loading analysis…
          </div>
        )}
        {isError && (
          <div className="text-bad text-sm text-center py-10">Failed to load policy data.</div>
        )}
        {data && (
          <>
            <SummaryCard
              summary={data.summary}
              policyName={data.policyName}
              insurer={data.insurer}
            />
            <div className="bg-card rounded-2xl border border-border p-5">
              <h3 className="font-semibold text-base text-foreground mb-4">Detailed Analysis</h3>
              <FeatureSection type="great"   features={data.features.great}   defaultOpen />
              <FeatureSection type="good"    features={data.features.good} />
              <FeatureSection type="bad"     features={data.features.bad}     defaultOpen />
              <FeatureSection type="unclear" features={data.features.unclear} />
            </div>
            {data.disclaimer && (
              <p className="text-xs text-muted-foreground text-center pb-4">{data.disclaimer}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function PoliciesBrowser() {
  const [activeInsurer, setActiveInsurer] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{ insurer: string; policy: PolicyMeta } | null>(null);

  const { data, isLoading, isError } = useQuery<{ insurers: InsurerGroup[] }>({
    queryKey: ["policies-list"],
    queryFn: () => getJson(`${API}/api/policies`),
  });

  const insurers = data?.insurers ?? [];

  // Set default active insurer once loaded
  if (insurers.length && !activeInsurer) setActiveInsurer(insurers[0].id);

  const currentGroup = insurers.find((g) => g.id === activeInsurer);
  const filtered = currentGroup?.policies.filter((p) =>
    p.policyName.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const totalPolicies = insurers.reduce((acc, g) => acc + g.policies.length, 0);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      {/* Page title */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-5">
          <h1 className="font-display text-2xl text-foreground">Policy Library</h1>
          {!isLoading && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {totalPolicies} policies across {insurers.length} insurers
            </p>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm animate-pulse">
          Loading policies…
        </div>
      )}
      {isError && (
        <div className="flex-1 flex items-center justify-center text-bad text-sm">
          Failed to load. Is the API server running?
        </div>
      )}

      {data && (
        <div className="flex-1 flex flex-col container mx-auto px-4 py-6 gap-4">
          {/* Insurer tabs */}
          <div className="flex gap-2 flex-wrap">
            {insurers.map((g) => (
              <button
                key={g.id}
                onClick={() => { setActiveInsurer(g.id); setSelected(null); setSearch(""); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeInsurer === g.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                }`}
              >
                {g.label}
                <span className="ml-1.5 opacity-60 text-xs">({g.policies.length})</span>
              </button>
            ))}
          </div>

          {/* Main area: list + optional detail panel */}
          <div className={`flex gap-5 flex-1 min-h-0 ${selected ? "items-start" : ""}`}>
            {/* Policy list */}
            <div className={`flex flex-col gap-3 transition-all duration-300 ${selected ? "w-[340px] flex-shrink-0" : "w-full"}`}>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search policies…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No policies match "{search}"</p>
              ) : (
                <div className={`grid gap-3 ${selected ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
                  {filtered.map((p) => (
                    <PolicyCard
                      key={p.id}
                      meta={p}
                      active={selected?.policy.id === p.id}
                      onClick={() =>
                        setSelected(
                          selected?.policy.id === p.id
                            ? null
                            : { insurer: activeInsurer, policy: p }
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Detail panel */}
            {selected && (
              <div className="flex-1 min-w-0 rounded-2xl border border-border bg-background overflow-hidden shadow-lg sticky top-[73px] max-h-[calc(100vh-100px)] flex flex-col">
                <DetailPanel
                  insurer={selected.insurer}
                  policy={selected.policy}
                  onClose={() => setSelected(null)}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
