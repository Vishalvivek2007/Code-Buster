"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Bug, CheckCircle2, XCircle, Loader2, Zap, Target, Lightbulb,
  BookOpen, Copy, Check, RotateCcw, Code2, Info, Sparkles, X,
  ChevronRight, Terminal,
} from "lucide-react";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="h-full bg-[#0A0A0B] flex items-center justify-center text-[#5A5A63] text-sm font-mono">
      Loading editor...
    </div>
  ),
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// ────────────────────────────────────────────────────────────────
// Types

type TestResult = {
  input: string;
  expected_output: string;
  actual_output: string;
  targets: string;
  passed: boolean;
  error_type: string | null;
};

type AnalyzeResponse = {
  approach_detected: string;
  weaknesses: string[];
  test_results: TestResult[];
  first_failure: TestResult | null;
  analysis: {
    bug_explanation: string;
    fix_hint: string;
    concept_to_review: string;
  } | null;
  all_passed: boolean;
};

// ────────────────────────────────────────────────────────────────
// Example problems

const EXAMPLES = [
  {
    name: "Integer Overflow",
    description: "Classic int vs long long",
    problem: `Given an array of integers, return the sum of all elements.

Input format:
- First line: integer N (1 <= N <= 10^5)
- Second line: N space-separated integers (each up to 10^9)

Output: A single integer (the sum)`,
    language: "cpp" as const,
    code: `#include <iostream>
using namespace std;
int main() {
    int n; cin >> n;
    int sum = 0;
    for (int i = 0; i < n; i++) {
        int x; cin >> x;
        sum += x;
    }
    cout << sum << endl;
    return 0;
}`,
  },
  {
    name: "Off-by-one",
    description: "Binary search edge case",
    problem: `Given a sorted array and a target, return the index of target, or -1 if not found.

Input format:
- First line: N (size of array)
- Second line: N sorted integers
- Third line: target value

Output: index (0-based) or -1`,
    language: "python" as const,
    code: `n = int(input())
arr = list(map(int, input().split()))
target = int(input())

lo, hi = 0, n
while lo < hi:
    mid = (lo + hi) // 2
    if arr[mid] == target:
        print(mid)
        exit()
    elif arr[mid] < target:
        lo = mid + 1
    else:
        hi = mid
print(-1)`,
  },
  {
    name: "Empty Input",
    description: "Doesn't handle N=0",
    problem: `Given an array, print the maximum element. If the array is empty, print "EMPTY".

Input:
- First line: N
- Second line: N integers (could be empty if N=0)

Output: max element or "EMPTY"`,
    language: "python" as const,
    code: `n = int(input())
arr = list(map(int, input().split()))
print(max(arr))`,
  },
];

// ────────────────────────────────────────────────────────────────
// Main component

export default function Home() {
  const [problem, setProblem] = useState(EXAMPLES[0].problem);
  const [language, setLanguage] = useState<"python" | "cpp">(EXAMPLES[0].language);
  const [code, setCode] = useState(EXAMPLES[0].code);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [showAbout, setShowAbout] = useState(false);

  const handleAnalyze = useCallback(async () => {
    if (!problem.trim() || !code.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setStage("Parsing problem statement");

    const stageTimers = [
      setTimeout(() => setStage("Generating adversarial test cases"), 1500),
      setTimeout(() => setStage("Compiling and executing your code"), 4500),
      setTimeout(() => setStage("Analyzing failure mode"), 8000),
      setTimeout(() => setStage("Synthesizing diagnosis"), 11500),
    ];

    try {
      const res = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem, code, language }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Network error" }));
        throw new Error(err.detail || `Server returned ${res.status}`);
      }

      const data: AnalyzeResponse = await res.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      stageTimers.forEach(clearTimeout);
      setLoading(false);
      setStage("");
    }
  }, [problem, code, language, loading]);

  // Ctrl+Enter shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleAnalyze();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleAnalyze]);

  const loadExample = (idx: number) => {
    const ex = EXAMPLES[idx];
    setProblem(ex.problem);
    setLanguage(ex.language);
    setCode(ex.code);
    setResult(null);
    setError(null);
  };

  const reset = () => {
    setProblem("");
    setCode("");
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[#27272D] bg-[#0A0A0B]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center">
                <Bug className="w-4 h-4 text-[#10B981]" />
              </div>
              <div className="flex items-baseline gap-2">
                <h1 className="text-[15px] font-semibold tracking-tight">
                  code<span className="text-[#10B981]">_</span>buster
                </h1>
                <span className="text-[10px] font-mono text-[#5A5A63] tracking-wider">v0.1.0</span>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-1 text-xs text-[#8A8A93]">
              <button
                onClick={() => setShowAbout(true)}
                className="px-3 py-1.5 hover:text-[#E5E5EA] transition-colors duration-100 flex items-center gap-1.5"
              >
                <Info className="w-3 h-3" /> How it works
              </button>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 hover:text-[#E5E5EA] transition-colors duration-100 flex items-center gap-1.5"
              >
                <Code2 className="w-3 h-3" /> Source
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="hidden sm:flex items-center gap-1.5 text-[#5A5A63]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
              <span>online</span>
            </div>
            <kbd className="hidden sm:inline-block text-[10px] px-1.5 py-0.5 rounded border border-[#27272D] bg-[#131316] text-[#8A8A93]">
              Ctrl+Enter
            </kbd>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-6">
        {/* Tagline */}
        <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Find the test case your code fails<span className="text-[#10B981]">.</span>
            </h2>
            <p className="text-sm text-[#8A8A93] mt-1 font-mono">
              Paste a problem, paste your code, get the smoking gun.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#5A5A63] mr-1">Examples:</span>
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                onClick={() => loadExample(i)}
                className="text-xs px-2.5 py-1.5 border border-[#27272D] hover:border-[#3A3A42] hover:bg-[#131316] text-[#8A8A93] hover:text-[#E5E5EA] transition-all duration-100 rounded font-mono"
                title={ex.description}
              >
                {ex.name}
              </button>
            ))}
            <button
              onClick={reset}
              className="text-xs p-1.5 border border-[#27272D] hover:border-[#3A3A42] hover:bg-[#131316] text-[#8A8A93] hover:text-[#E5E5EA] transition-all duration-100 rounded"
              title="Clear all"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Input grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
          {/* Problem panel */}
          <Panel
            label="Problem"
            icon={<Target className="w-3 h-3" />}
            badge={`${problem.length} chars`}
          >
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="Paste the problem statement, including input/output format and constraints..."
              spellCheck={false}
              className="w-full h-[320px] bg-transparent text-[13px] font-mono text-[#E5E5EA] placeholder-[#5A5A63] resize-none focus:outline-none p-4 leading-relaxed"
            />
          </Panel>

          {/* Code panel */}
          <Panel
            label="Code"
            icon={<Zap className="w-3 h-3" />}
            badge={
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as "python" | "cpp")}
                className="bg-[#131316] border border-[#27272D] rounded text-[10px] font-mono text-[#8A8A93] px-2 py-0.5 focus:outline-none focus:border-[#3A3A42] cursor-pointer"
              >
                <option value="cpp">cpp</option>
                <option value="python">python</option>
              </select>
            }
          >
            <div className="h-[320px]">
              <Editor
                height="100%"
                language={language === "cpp" ? "cpp" : "python"}
                value={code}
                onChange={(v) => setCode(v || "")}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: "var(--font-mono), ui-monospace, monospace",
                  fontLigatures: true,
                  scrollBeyondLastLine: false,
                  padding: { top: 14, bottom: 14 },
                  lineNumbers: "on",
                  renderLineHighlight: "none",
                  scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
                  overviewRulerLanes: 0,
                }}
              />
            </div>
          </Panel>
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-[11px] font-mono text-[#5A5A63] flex items-center gap-2">
            <Terminal className="w-3 h-3" />
            sandboxed · 5s timeout · 256MB
          </p>
          <button
            onClick={handleAnalyze}
            disabled={loading || !problem.trim() || !code.trim()}
            className="group relative px-5 py-2.5 bg-[#10B981] hover:bg-[#0D9668] disabled:bg-[#1C1C21] disabled:text-[#5A5A63] text-[#0A0A0B] disabled:cursor-not-allowed font-semibold text-sm tracking-tight rounded transition-all duration-100 flex items-center gap-2 shadow-[0_0_0_1px_rgba(16,185,129,0.2)] hover:shadow-[0_0_24px_rgba(16,185,129,0.4)] disabled:shadow-none"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="terminal-cursor">{stage}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                BUST IT
              </>
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 p-4 border border-[#4C1414] bg-[#EF4444]/5 rounded animate-slide-up">
            <div className="flex items-start gap-3">
              <XCircle className="w-4 h-4 text-[#EF4444] mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-[#EF4444] mb-1">Error</div>
                <p className="text-sm text-[#E5E5EA]">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !result && <LoadingSkeleton />}

        {/* Results */}
        {result && <Results result={result} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#27272D] mt-8">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[#5A5A63]">
          <div>
            built with FastAPI + Next.js · powered by Llama 3.3 via Groq
          </div>
          <div className="flex items-center gap-4">
            <span>made with ❤️ by Vishal Vivek</span>
            <a href="https://github.com/Vishalvivek2007" target="_blank" rel="noreferrer" className="hover:text-[#E5E5EA] transition-colors">
              github
            </a>
          </div>
        </div>
      </footer>

      {/* About modal */}
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Panel — the wrapper for input cards

function Panel({
  label, icon, badge, children,
}: {
  label: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-[#27272D] rounded bg-[#131316] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#27272D] bg-[#0A0A0B]/40">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.15em] text-[#8A8A93]">
          {icon}
          {label}
        </div>
        {typeof badge === "string" ? (
          <span className="text-[10px] font-mono text-[#5A5A63]">{badge}</span>
        ) : (
          badge
        )}
      </div>
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Loading skeleton

function LoadingSkeleton() {
  return (
    <div className="border border-[#27272D] rounded bg-[#131316] p-6 relative overflow-hidden animate-slide-up">
      <div className="scan-line" />
      <div className="space-y-3">
        <div className="h-3 w-1/3 bg-[#1C1C21] rounded animate-pulse" />
        <div className="h-3 w-1/2 bg-[#1C1C21] rounded animate-pulse" />
        <div className="h-3 w-2/5 bg-[#1C1C21] rounded animate-pulse" />
        <div className="grid grid-cols-3 gap-3 mt-6">
          <div className="h-24 bg-[#1C1C21] rounded animate-pulse" />
          <div className="h-24 bg-[#1C1C21] rounded animate-pulse" />
          <div className="h-24 bg-[#1C1C21] rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Results

function Results({ result }: { result: AnalyzeResponse }) {
  const [tab, setTab] = useState<"failure" | "fix" | "all" | "weaknesses">(
    result.first_failure ? "failure" : "all"
  );

  const passedCount = result.test_results.filter((t) => t.passed).length;
  const totalCount = result.test_results.length;

  return (
    <div className="border border-[#27272D] rounded bg-[#131316] overflow-hidden animate-slide-up">
      {/* Verdict bar */}
      <div className="px-5 py-4 border-b border-[#27272D] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {result.all_passed ? (
            <>
              <div className="w-8 h-8 rounded bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[#10B981]">All cases passed</div>
                <div className="text-xs text-[#8A8A93] font-mono mt-0.5">
                  Your code survived {totalCount} adversarial tests
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="w-8 h-8 rounded bg-[#EF4444]/10 border border-[#EF4444]/30 flex items-center justify-center">
                <XCircle className="w-4 h-4 text-[#EF4444]" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[#EF4444]">Bug found</div>
                <div className="text-xs text-[#8A8A93] font-mono mt-0.5">
                  Failed on case targeting <span className="text-[#E5E5EA]">{result.first_failure?.targets}</span>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-[#5A5A63]">
            Approach detected
          </div>
          <div className="text-xs font-mono text-[#E5E5EA] bg-[#0A0A0B] border border-[#27272D] px-2 py-1 rounded max-w-[280px] truncate">
            {result.approach_detected}
          </div>
          <div className="text-xs font-mono">
            <span className={passedCount === totalCount ? "text-[#10B981]" : "text-[#EF4444]"}>
              {passedCount}
            </span>
            <span className="text-[#5A5A63]">/{totalCount}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#27272D] bg-[#0A0A0B]/40">
        {result.first_failure && <Tab id="failure" active={tab} onClick={setTab} icon={<XCircle className="w-3 h-3" />}>Failing case</Tab>}
        {result.analysis && <Tab id="fix" active={tab} onClick={setTab} icon={<Lightbulb className="w-3 h-3" />}>Diagnosis</Tab>}
        <Tab id="all" active={tab} onClick={setTab} icon={<Terminal className="w-3 h-3" />}>All tests <span className="ml-1 text-[#5A5A63]">{totalCount}</span></Tab>
        <Tab id="weaknesses" active={tab} onClick={setTab} icon={<Target className="w-3 h-3" />}>Weaknesses <span className="ml-1 text-[#5A5A63]">{result.weaknesses.length}</span></Tab>
      </div>

      <div className="p-5">
        {tab === "failure" && result.first_failure && <FailureView tc={result.first_failure} />}
        {tab === "fix" && result.analysis && <FixView analysis={result.analysis} />}
        {tab === "all" && <AllTestsView results={result.test_results} />}
        {tab === "weaknesses" && <WeaknessesView weaknesses={result.weaknesses} />}
      </div>
    </div>
  );
}

function Tab({
  id, active, onClick, icon, children,
}: {
  id: "failure" | "fix" | "all" | "weaknesses";
  active: string;
  onClick: (t: typeof id) => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const isActive = active === id;
  return (
    <button
      onClick={() => onClick(id)}
      className={`px-4 py-2.5 text-xs font-mono flex items-center gap-1.5 border-b-2 transition-all duration-100 ${
        isActive
          ? "border-[#10B981] text-[#E5E5EA] bg-[#131316]"
          : "border-transparent text-[#8A8A93] hover:text-[#E5E5EA] hover:bg-[#131316]/50"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

// ────────────────────────────────────────────────────────────────
// Sub-views

function FailureView({ tc }: { tc: TestResult }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-wider text-[#5A5A63] mb-2">
          Targets weakness
        </div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] rounded text-xs font-mono">
          <ChevronRight className="w-3 h-3" />
          {tc.targets}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <CodeBlock label="Input" content={tc.input} />
        <CodeBlock label="Expected" content={tc.expected_output} variant="success" />
        <CodeBlock label="Got" content={tc.actual_output || "(empty)"} variant="danger" />
      </div>
    </div>
  );
}

function FixView({ analysis }: { analysis: NonNullable<AnalyzeResponse["analysis"]> }) {
  return (
    <div className="space-y-5">
      <Section icon={<Bug className="w-3.5 h-3.5" />} label="The bug">
        <p className="text-sm text-[#E5E5EA] leading-relaxed">{analysis.bug_explanation}</p>
      </Section>
      <Section icon={<Lightbulb className="w-3.5 h-3.5" />} label="Hint toward the fix">
        <p className="text-sm text-[#E5E5EA] leading-relaxed">{analysis.fix_hint}</p>
      </Section>
      <Section icon={<BookOpen className="w-3.5 h-3.5" />} label="Concept to review">
        <div className="inline-flex items-center px-3 py-1.5 bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] rounded text-xs font-mono">
          {analysis.concept_to_review}
        </div>
      </Section>
    </div>
  );
}

function Section({
  icon, label, children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[#5A5A63] mb-2">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

function AllTestsView({ results }: { results: TestResult[] }) {
  return (
    <div className="space-y-2">
      {results.map((t, i) => (
        <details
          key={i}
          className="border border-[#27272D] rounded bg-[#0A0A0B]/40 group"
          open={!t.passed}
        >
          <summary className="px-3 py-2.5 cursor-pointer flex items-center justify-between hover:bg-[#131316]/50 transition-colors duration-100 list-none">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-[10px] font-mono text-[#5A5A63]">#{String(i + 1).padStart(2, "0")}</span>
              <span className="text-xs text-[#E5E5EA] truncate font-mono">{t.targets}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {t.passed ? (
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] rounded">PASS</span>
              ) : (
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] rounded">FAIL</span>
              )}
              <ChevronRight className="w-3 h-3 text-[#5A5A63] group-open:rotate-90 transition-transform" />
            </div>
          </summary>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 border-t border-[#27272D]">
            <CodeBlock label="Input" content={t.input} compact />
            <CodeBlock label="Expected" content={t.expected_output} variant="success" compact />
            <CodeBlock label="Got" content={t.actual_output || "(empty)"} variant={t.passed ? "success" : "danger"} compact />
          </div>
        </details>
      ))}
    </div>
  );
}

function WeaknessesView({ weaknesses }: { weaknesses: string[] }) {
  return (
    <ul className="space-y-2">
      {weaknesses.map((w, i) => (
        <li
          key={i}
          className="flex items-start gap-3 text-sm text-[#E5E5EA] p-3 border border-[#27272D] rounded bg-[#0A0A0B]/40"
        >
          <span className="text-[10px] font-mono text-[#5A5A63] mt-1">{String(i + 1).padStart(2, "0")}</span>
          <span className="leading-relaxed">{w}</span>
        </li>
      ))}
    </ul>
  );
}

// ────────────────────────────────────────────────────────────────
// CodeBlock with copy

function CodeBlock({
  label, content, variant = "neutral", compact = false,
}: {
  label: string;
  content: string;
  variant?: "neutral" | "success" | "danger";
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const colors = {
    neutral: { text: "text-[#E5E5EA]", border: "border-[#27272D]" },
    success: { text: "text-[#10B981]", border: "border-[#10B981]/20" },
    danger: { text: "text-[#EF4444]", border: "border-[#EF4444]/20" },
  }[variant];

  return (
    <div className={`bg-[#0A0A0B] border ${colors.border} rounded overflow-hidden flex flex-col`}>
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#27272D]">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[#5A5A63]">{label}</span>
        <button
          onClick={copy}
          className="text-[#5A5A63] hover:text-[#E5E5EA] transition-colors duration-100"
          title="Copy"
        >
          {copied ? <Check className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
      <pre className={`${compact ? "text-[11px]" : "text-xs"} font-mono ${colors.text} p-3 overflow-auto whitespace-pre-wrap break-all flex-1 max-h-48`}>
        {content || <span className="text-[#5A5A63]">(empty)</span>}
      </pre>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// About modal

function AboutModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-30 bg-[#0A0A0B]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-slide-up"
      onClick={onClose}
    >
      <div
        className="max-w-lg w-full bg-[#131316] border border-[#27272D] rounded shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#27272D]">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Info className="w-4 h-4 text-[#10B981]" />
            How code_buster works
          </div>
          <button onClick={onClose} className="text-[#8A8A93] hover:text-[#E5E5EA] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4 text-sm text-[#E5E5EA] leading-relaxed">
          <Step n={1} title="Adversarial test generation">
            An LLM analyzes your problem statement and code, identifies likely weaknesses (overflow, edge cases, off-by-one, etc.), and generates test cases targeting them.
          </Step>
          <Step n={2} title="Sandboxed execution">
            Your code runs in an isolated subprocess with a 5-second timeout against each test case. Output is captured and normalized.
          </Step>
          <Step n={3} title="Smoking-gun diagnosis">
            On the first failure, a second LLM call explains *why* it failed and hints at the fix — without giving you the answer outright.
          </Step>
          <div className="pt-3 mt-2 border-t border-[#27272D] text-xs text-[#8A8A93] font-mono space-y-1.5">
            <div className="text-[#5A5A63] uppercase tracking-wider mb-2">Caveats</div>
            <p>· Problems with multiple valid outputs may produce false positives</p>
            <p>· The LLM occasionally hallucinates expected outputs — verify before trusting</p>
            <p>· This is a learning tool, not a substitute for thinking</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-6 h-6 rounded bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] flex items-center justify-center text-xs font-mono flex-shrink-0">
        {n}
      </div>
      <div>
        <div className="font-semibold text-sm mb-1">{title}</div>
        <div className="text-xs text-[#8A8A93]">{children}</div>
      </div>
    </div>
  );
}