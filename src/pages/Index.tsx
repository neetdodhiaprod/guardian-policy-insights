import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Upload, FileText, X, ArrowRight, Check, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import ResultsSection from "@/components/ResultsSection";
import Footer from "@/components/Footer";
import { PolicyAnalysis } from "@/lib/mockData";
import { DEFAULT_POLICIES } from "@/data/defaultPolicies";
import { extractTextFromPDF } from "@/utils/pdfExtractor";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

type PolicyMeta = { id: string; policyName: string; policyType: string; summary: any };
type InsurerGroup = { id: string; label: string; policies: PolicyMeta[] };

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const INSURER_DISPLAY: Record<string, { short: string; color: string; bg: string }> = {
  "aditya-birla":     { short: "AB", color: "#C9583A", bg: "#FAF0EB" },
  "care":             { short: "CH", color: "#C43040", bg: "#FAF0F0" },
  "hdfc-ergo":        { short: "HE", color: "#005084", bg: "#EEF3F8" },
  "icici-lombard":    { short: "IL", color: "#D4821A", bg: "#FAF3E8" },
  "niva-bupa":        { short: "NB", color: "#A82429", bg: "#FAF0F0" },
  "star-health-care": { short: "SH", color: "#1A638F", bg: "#EBF3F8" },
};

// ─── Select-from-library path ────────────────────────────────────────────────

function SelectPath({ onResult }: { onResult: (data: PolicyAnalysis, insurerId: string) => void }) {
  const [insurerId, setInsurerId] = useState("");
  const [policyId, setPolicyId] = useState("");
  const [policySearch, setPolicySearch] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ insurers: InsurerGroup[] }>({
    queryKey: ["policies-list"],
    queryFn: () => getJson(`${API}/api/policies`),
  });

  const insurers = data?.insurers ?? [];
  const activeInsurer = insurers.find((g) => g.id === insurerId);
  const allPolicies = activeInsurer?.policies ?? [];
  const policies = policySearch.trim()
    ? allPolicies.filter((p) => p.policyName.toLowerCase().includes(policySearch.toLowerCase()))
    : allPolicies;

  const handleView = async () => {
    if (!insurerId || !policyId) return;
    setLoading(true);
    try {
      const result = await getJson<PolicyAnalysis>(`${API}/api/policies/${insurerId}/${policyId}`);
      onResult(result, insurerId);
    } catch {
      toast({ variant: "destructive", title: "Failed to load policy", description: "Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleFlagship = async () => {
    const flagship = DEFAULT_POLICIES[insurerId];
    if (!flagship) return;
    setLoading(true);
    try {
      const result = await getJson<PolicyAnalysis>(`${API}/api/policies/${insurerId}/${flagship.policyId}`);
      onResult(result, insurerId);
    } catch {
      toast({ variant: "destructive", title: "Failed to load policy", description: "Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step 1 — Insurer grid */}
      <div>
        <p className="label-editorial text-muted-foreground rule-left mb-3">
          Step 1 — Select your insurer
        </p>
        {isLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-surface-sunken animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {insurers.map((g) => {
              const d = INSURER_DISPLAY[g.id];
              const isActive = insurerId === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => { setInsurerId(g.id); setPolicyId(""); setPolicySearch(""); }}
                  className={`relative flex flex-col items-center justify-center gap-1 h-16 rounded-lg border text-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isActive
                      ? "shadow-sm scale-[1.02]"
                      : "border-border hover:shadow-sm hover:scale-[1.01] bg-card"
                  }`}
                  style={isActive ? { background: d?.bg, borderColor: d?.color, borderWidth: "1.5px" } : {}}
                >
                  {isActive && (
                    <span
                      className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: d?.color }}
                    >
                      <Check className="w-2.5 h-2.5 text-white" />
                    </span>
                  )}
                  <span
                    className="w-8 h-8 rounded-sm flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: d?.color ?? "#888" }}
                  >
                    {d?.short ?? g.id.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="text-xs font-medium text-foreground leading-tight px-1 line-clamp-1">
                    {g.label.replace(" Health Insurance", "").replace(" General Insurance", "")}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Step 2 — Policy list */}
      <div className={`transition-all duration-300 ${insurerId ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
        <p className="label-editorial text-muted-foreground rule-left mb-3">
          Step 2 — Select your policy
          {allPolicies.length > 0 && <span className="font-normal normal-case ml-1">({allPolicies.length} available)</span>}
        </p>

        {/* Flagship shortcut */}
        {insurerId && DEFAULT_POLICIES[insurerId] && (
          <button
            onClick={handleFlagship}
            disabled={loading}
            className="w-full flex items-center gap-2 justify-center text-xs font-semibold text-primary border border-primary-muted bg-primary-surface hover:bg-primary/10 rounded-lg px-4 py-2.5 mb-3 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            I don't know my policy — show me the most common one
          </button>
        )}
        {allPolicies.length > 5 && (
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search policy name…"
              value={policySearch}
              onChange={(e) => setPolicySearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>
        )}
        <div className="max-h-52 overflow-y-auto rounded-lg border border-border divide-y divide-border/60">
          {policies.length === 0 && insurerId && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {policySearch ? `No policies matching "${policySearch}"` : "No policies found"}
            </div>
          )}
          {!insurerId && (
            <div className="py-6 text-center text-sm text-muted-foreground">Select an insurer above</div>
          )}
          {policies.map((p) => {
            const d = INSURER_DISPLAY[insurerId];
            const isSelected = policyId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setPolicyId(p.id)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-surface-sunken ${
                  isSelected ? "bg-surface-sunken" : "bg-card"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{p.policyName}</p>
                  {p.policyType && p.policyType !== "Not specified" && (
                    <p className="text-xs text-muted-foreground mt-0.5">{p.policyType}</p>
                  )}
                </div>
                {isSelected && (
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ml-3"
                    style={{ background: d?.color ?? "#888" }}
                  >
                    <Check className="w-3 h-3 text-white" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Button
        onClick={handleView}
        disabled={!insurerId || !policyId || loading}
        size="lg"
        className="w-full h-12 font-semibold text-base"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            Loading analysis…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            View Analysis <ArrowRight className="w-4 h-4" />
          </span>
        )}
      </Button>
    </div>
  );
}

// ─── Upload-your-PDF path ────────────────────────────────────────────────────

type UploadStage = "idle" | "extracting" | "identifying";

function UploadPath({ onResult }: { onResult: (data: PolicyAnalysis, insurerId: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [stage, setStage] = useState<UploadStage>("idle");
  const { toast } = useToast();

  const accept = (f: File) => {
    if (f.type !== "application/pdf") {
      toast({ variant: "destructive", title: "Invalid file", description: "Please upload a PDF file." });
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Maximum size is 20 MB." });
      return;
    }
    setFile(f);
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) accept(e.dataTransfer.files[0]);
  }, []);

  const handleIdentify = async () => {
    if (!file) return;
    setStage("extracting");

    let text: string;
    try {
      text = await extractTextFromPDF(file);
    } catch (err: any) {
      setStage("idle");
      toast({ variant: "destructive", title: "Could not read PDF", description: err?.message ?? "Try a different file." });
      return;
    }

    setStage("identifying");
    try {
      const res = await fetch(`${API}/api/policies/identify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 30_000) }),
      });
      const json = await res.json();
      if (json.matched) {
        const enriched = { ...json.data, customerInfo: json.customerInfo ?? null };
        onResult(enriched, json.insurerId ?? '');
      } else {
        const hint = json.insurerLabel
          ? ` Try selecting "I don't know my policy" for ${json.insurerLabel} in the library.`
          : '';
        toast({
          variant: "destructive",
          title: "Policy not found in our library",
          description: (json.reason ?? "We couldn't match this document.") + hint,
        });
        setStage("idle");
      }
    } catch {
      toast({ variant: "destructive", title: "Identification failed", description: "Server error. Please try again." });
      setStage("idle");
    }
  };

  const isLoading = stage !== "idle";

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-xl transition-all duration-200 ${
          dragActive
            ? "border-primary bg-primary-surface scale-[1.01]"
            : file
            ? "border-great-border bg-great-bg/50"
            : "border-border hover:border-primary hover:bg-primary-surface"
        } ${!file && !isLoading ? "cursor-pointer" : ""}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !file && !isLoading && document.getElementById("pdf-upload")?.click()}
      >
        <input
          id="pdf-upload"
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && accept(e.target.files[0])}
        />

        {file ? (
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="w-10 h-10 bg-great-bg rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-great-text" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); if (!isLoading) { setFile(null); setStage("idle"); } }}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center text-center px-6">
            <div className="w-12 h-12 bg-surface-sunken rounded-lg flex items-center justify-center mb-4">
              <Upload className="w-5 h-5 text-primary" />
            </div>
            <p className="font-semibold text-sm text-foreground mb-1">
              Upload your policy document
            </p>
            <p className="text-xs text-muted-foreground">
              Drop the PDF here or{" "}
              <span className="text-primary underline underline-offset-2 cursor-pointer">choose file</span>
              {" "}· PDF up to 20 MB
            </p>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin flex-shrink-0" />
          <span className="animate-pulse">
            {stage === "extracting" ? "Reading your document…" : "Finding policy in our library…"}
          </span>
        </div>
      )}

      <Button
        onClick={handleIdentify}
        disabled={!file || isLoading}
        size="lg"
        className="w-full h-12 font-semibold text-base"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            {stage === "extracting" ? "Extracting…" : "Identifying…"}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            Identify &amp; Analyse <ArrowRight className="w-4 h-4" />
          </span>
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        Supports policies from Aditya Birla, Care, HDFC ERGO, ICICI Lombard, Niva Bupa &amp; Star Health
      </p>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

type Mode = "select" | "upload";

const Index = () => {
  const [mode, setMode] = useState<Mode>("upload");
  const [result, setResult] = useState<PolicyAnalysis | null>(null);
  const [resultInsurerId, setResultInsurerId] = useState('');

  const handleResult = (data: PolicyAnalysis, insurerId: string) => {
    setResult(data);
    setResultInsurerId(insurerId);
  };

  const handleReset = () => {
    setResult(null);
    setResultInsurerId('');
  };

  if (result) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 pb-16">
          {/* Slim results nav — back link + data source */}
          <div className="container mx-auto px-4 pt-5 pb-4">
            <div className="max-w-4xl mx-auto flex items-center justify-between animate-enter-up">
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <span aria-hidden>←</span> Analyse another policy
              </button>
              <p className="label-editorial text-muted-foreground hidden sm:block">
                IRDAI data · FY 2023–24
              </p>
            </div>
          </div>
          <div className="container mx-auto px-4 pb-4">
            <div className="max-w-4xl mx-auto animate-enter-up" style={{ animationDelay: "0.05s" }}>
              <ResultsSection analysis={result} insurerId={resultInsurerId} onReset={handleReset} />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto px-4 pt-14 pb-8 text-center">
          <p className="label-editorial text-primary mb-4 animate-enter-up">
            Guardian Policy Insights
          </p>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl text-foreground mb-5 animate-enter-up leading-tight" style={{ animationDelay: "0.05s" }}>
            Know your policy<br className="hidden sm:block" /> before you need it.
          </h1>
          <p className="font-body text-base md:text-lg text-muted-foreground max-w-xl mx-auto animate-enter-up mb-7" style={{ animationDelay: "0.1s" }}>
            Most Indians discover hidden co-pay clauses only during a hospital stay.
            Get an independent breakdown of your policy in seconds — free.
          </p>
          {/* Trust bar */}
          <div
            className="flex items-center justify-center flex-wrap gap-x-5 gap-y-2 animate-enter-up"
            style={{ animationDelay: "0.15s" }}
          >
            {[
              { value: "103", label: "policies in library" },
              { value: "6",   label: "major insurers" },
              { value: "Free", label: "always" },
            ].map((s, i) => (
              <span key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                {i > 0 && <span className="w-px h-3.5 bg-border hidden sm:block" />}
                <span className="font-semibold text-foreground">{s.value}</span>
                <span>{s.label}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="container mx-auto px-4 pb-16">
          <div className="max-w-lg mx-auto animate-enter-up" style={{ animationDelay: "0.2s" }}>
            <div className="bg-card rounded-3xl shadow-card overflow-hidden border border-border border-t-4 border-t-primary">
              {mode === "select" && (
                <div className="flex items-center gap-2 px-6 pt-5 pb-0">
                  <button
                    onClick={() => setMode("upload")}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    ← Back to upload
                  </button>
                </div>
              )}
              <div className="p-6 md:p-8">
                {mode === "select" ? (
                  <SelectPath onResult={handleResult} />
                ) : (
                  <UploadPath onResult={handleResult} />
                )}
              </div>
            </div>

            {mode === "upload" && (
              <p className="text-center text-xs text-muted-foreground mt-4">
                Don't have your document?{" "}
                <button
                  onClick={() => setMode("select")}
                  className="underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  Browse policies by insurer
                </button>
              </p>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
