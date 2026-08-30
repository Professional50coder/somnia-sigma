"use client";

import { useState, useEffect, useRef } from "react";
import { animate, stagger, onScroll } from "animejs";
import { BarChart3, TrendingUp, Target, Activity, Info, AlertTriangle } from "lucide-react";
import { SigmaNav } from "@/components/sigma/sigma-nav";
import { Backtest3D } from "@/components/sigma/backtest-3d";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface CalibrationBucket {
  bucket: number;
  n: number;
  meanPredicted: number;
  realisedFreq: number;
}

interface TauBucket {
  label: string;
  n: number;
  meanPredicted: number;
  realisedFreq: number;
  brier: number;
}

interface CadenceResult {
  cadence: string;
  n: number;
  meanPredicted: number;
  realisedFreq: number;
  brier: number;
}

interface BacktestResults {
  source: string;
  totalBars: number;
  totalCheckpoints: number;
  brier: number;
  logloss: number;
  calibration: CalibrationBucket[];
  tauBuckets: TauBucket[];
  byCadence: CadenceResult[];
}

function AnimatedBar({ predicted, realised, delay }: { predicted: number; realised: number; delay: number }) {
  const barRef = useRef<HTMLDivElement>(null);
  const predRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      if (barRef.current) {
        animate(barRef.current, { width: `${Math.max(2, realised * 100)}%`, duration: 600, ease: "outExpo" });
      }
      if (predRef.current) {
        animate(predRef.current, { width: `${Math.max(2, predicted * 100)}%`, duration: 600, ease: "outExpo" });
      }
    }, delay);
    return () => clearTimeout(t);
  }, [delay, predicted, realised]);

  return (
    <div className="flex-1 relative h-5 bg-secondary/50 rounded overflow-hidden group cursor-pointer">
      <div ref={barRef} className="absolute left-0 top-0 h-full bg-primary/60 rounded" style={{ width: 0 }} />
      <div ref={predRef} className="absolute left-0 top-0 h-full border-r-2 border-accent" style={{ width: 0 }} />
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-[10px] font-mono text-foreground">
        Predicted {(predicted * 100).toFixed(1)}% → Realised {(realised * 100).toFixed(1)}%
      </div>
    </div>
  );
}

function CalibrationCard({ b, delay }: { b: CalibrationBucket; delay: number }) {
  const gap = b.meanPredicted - b.realisedFreq;
  return (
    <div className="calibration-row flex items-center gap-3 text-xs font-mono">
      <span className="w-6 text-right text-muted-foreground">{b.bucket}</span>
      <AnimatedBar predicted={b.meanPredicted} realised={b.realisedFreq} delay={delay} />
      <span className="w-16 text-right text-muted-foreground">
        {(b.meanPredicted * 100).toFixed(1)}%
      </span>
      <span className="w-16 text-right text-foreground">
        {(b.realisedFreq * 100).toFixed(1)}%
      </span>
      <span className={`w-16 text-right font-medium ${gap > 0 ? "text-negative" : "text-positive"}`}>
        {gap > 0 ? "+" : ""}{(gap * 100).toFixed(1)}%
      </span>
      <span className="w-12 text-right text-muted-foreground">
        n={b.n}
      </span>
    </div>
  );
}

function SkeletonBacktest() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="sigma-card p-3">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>
      <div className="sigma-card p-5">
        <Skeleton className="h-4 w-48 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BacktestPage() {
  const [results, setResults] = useState<BacktestResults | null>(null);
  const [loading, setLoading] = useState(true);
  const headerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/backtest");
        if (res.ok) {
          setResults(await res.json());
          toast.success("Backtest loaded", { description: "Calibration data ready" });
        }
      } catch {
        // keep null
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Animate header on mount
  useEffect(() => {
    if (headerRef.current) {
      animate(headerRef.current, {
        opacity: [0, 1],
        translateY: [12, 0],
        duration: 500,
        ease: "outExpo",
      });
    }
  }, []);

  // Animate summary cards when results load (using stagger from center)
  useEffect(() => {
    if (!results || !cardsRef.current) return;
    const cards = cardsRef.current.querySelectorAll("[data-card]");
    animate(cards, {
      opacity: [0, 1],
      translateY: [20, 0],
      scale: [0.92, 1],
      duration: 500,
      delay: stagger(60, { from: "center", jitter: 30 }),
      ease: "outExpo",
    });
  }, [results]);

  return (
    <div className="h-screen flex flex-col overflow-hidden relative" style={{ backgroundColor: "#070709" }}>
      <div className="absolute inset-0 opacity-40"><Backtest3D /></div>
      <div className="relative z-10 flex flex-col h-full">
      <SigmaNav />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto px-6 py-6" style={{ maxWidth: "1200px" }}>
          <div ref={headerRef} style={{ opacity: 0 }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-semibold text-foreground">Backtest Calibration</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {results?.source ?? "Loading..."}
                </p>
              </div>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-1 rounded">
                REPLAY
              </span>
            </div>

            {loading ? (
              <SkeletonBacktest />
            ) : !results ? (
              <div className="text-center py-12">
                <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No backtest results found. Run the backtest first.</p>
              </div>
            ) : (
              <Tabs defaultValue="calibration" className="space-y-6">
                <TabsList>
                  <TabsTrigger value="calibration" className="gap-1.5">
                    <Target className="w-3.5 h-3.5" />
                    Calibration
                  </TabsTrigger>
                  <TabsTrigger value="time" className="gap-1.5">
                    <Activity className="w-3.5 h-3.5" />
                    By Time (τ)
                  </TabsTrigger>
                  <TabsTrigger value="cadence" className="gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    By Cadence
                  </TabsTrigger>
                </TabsList>

                {/* Summary cards */}
                <div ref={cardsRef} className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Brier Score", value: results.brier.toFixed(4), good: results.brier < 0.25 },
                    { label: "Log Loss", value: results.logloss.toFixed(4), good: results.logloss < 0.7 },
                    { label: "Checkpoints", value: results.totalCheckpoints.toLocaleString(), good: true },
                    { label: "BTC Bars", value: results.totalBars.toLocaleString(), good: true },
                  ].map((card) => (
                    <div key={card.label} data-card className="sigma-card p-3 opacity-0">
                      <div className="sigma-label mb-1">{card.label}</div>
                      <div className={`font-mono text-lg font-semibold ${card.good ? "text-foreground" : "text-yellow-500"}`}>
                        {card.value}
                      </div>
                      {card.label === "Brier Score" && (
                        <Progress value={Math.max(0, (1 - results.brier) * 100)} className="mt-2 h-1" />
                      )}
                      {card.label === "Log Loss" && (
                        <Progress value={Math.max(0, (1 - results.logloss) * 100)} className="mt-2 h-1" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Calibration Tab */}
                <TabsContent value="calibration" className="space-y-6 mt-0">
                  <div className="sigma-card p-5">
                    <h3 className="text-sm font-medium text-foreground mb-4">Calibration Curve — Predicted vs Realised</h3>
                    <div className="space-y-2">
                      {results.calibration.map((b, i) => (
                        <CalibrationCard key={b.bucket} b={b} delay={i * 60} />
                      ))}
                    </div>
                    <div className="flex items-center gap-6 mt-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-2 bg-primary/60 rounded" /> Realised
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-0.5 h-2 bg-accent" /> Predicted
                      </span>
                    </div>
                  </div>

                  {/* Tail overconfidence */}
                  <div className="sigma-card p-4 border-l-2 border-yellow-500">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-foreground">Tail Overconfidence Found</div>
                        <p className="text-xs text-muted-foreground mt-1">
                          The model is systematically overconfident in the tails — predicted ~0.2% at the low end
                          realises ~14%; predicted ~99.6% at the high end realises ~91.5%. Well-calibrated in
                          the middle (buckets 3–6). This is the expected failure mode of zero-drift GBM
                          understating fat tails. Reported as found, not tuned away.
                        </p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Time Remaining Tab */}
                <TabsContent value="time" className="mt-0">
                  <div className="sigma-card overflow-hidden">
                    <div className="px-4 py-3 border-b border-border">
                      <h3 className="text-sm font-medium text-foreground">By Time Remaining (τ)</h3>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">τ Bucket</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">Checkpoints</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">Mean Predicted</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">Realised</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">Brier</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">Quality</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.tauBuckets.map((b, i) => (
                          <tr
                            key={b.label}
                            className="tau-row border-b border-border/50 hover:bg-secondary/30 transition-colors"
                            style={{ animationDelay: `${i * 50}ms` }}
                          >
                            <td className="px-4 py-2.5 text-foreground">{b.label}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{b.n}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-foreground">{(b.meanPredicted * 100).toFixed(1)}%</td>
                            <td className="px-4 py-2.5 text-right font-mono text-foreground">{(b.realisedFreq * 100).toFixed(1)}%</td>
                            <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{b.brier.toFixed(4)}</td>
                            <td className="px-4 py-2.5 text-right">
                              <Progress value={Math.max(0, (1 - b.brier) * 100)} className="h-1.5 w-16 ml-auto" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                {/* Cadence Tab */}
                <TabsContent value="cadence" className="mt-0">
                  <div className="sigma-card overflow-hidden">
                    <div className="px-4 py-3 border-b border-border">
                      <h3 className="text-sm font-medium text-foreground">By Window Cadence</h3>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Cadence</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">Checkpoints</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">Mean Predicted</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">Realised</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">Brier</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.byCadence.map((b, i) => (
                          <tr
                            key={b.cadence}
                            className="cadence-row border-b border-border/50 hover:bg-secondary/30 transition-colors"
                            style={{ animationDelay: `${i * 50}ms` }}
                          >
                            <td className="px-4 py-2.5 text-foreground font-medium">{b.cadence}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{b.n}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-foreground">{(b.meanPredicted * 100).toFixed(1)}%</td>
                            <td className="px-4 py-2.5 text-right font-mono text-foreground">{(b.realisedFreq * 100).toFixed(1)}%</td>
                            <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{b.brier.toFixed(4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                {/* Assumptions - Accordion */}
                <Accordion type="single" collapsible className="sigma-card">
                  <AccordionItem value="assumptions" className="border-0">
                    <AccordionTrigger className="px-4 py-3 text-sm font-medium text-foreground hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Info className="w-4 h-4 text-muted-foreground" />
                        Assumptions & Limitations
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4">
                      <ul className="text-xs text-muted-foreground space-y-1.5 pb-2">
                        <li>~2 days of BTC/USDC M1 candles (3,000 bars). Directional evidence, not a large-sample proof.</li>
                        <li>~230 independent windows (not 5,620 — checkpoints within a window share settlement outcome).</li>
                        <li>Volatility: single continuous EWMA (λ converted by half-life, not copied raw).</li>
                        <li>Model: Φ(d₂) zero-drift GBM, terminal settlement. Known to understate fat tails.</li>
                        <li>Policy simulation discarded — synthetic book proxy was self-correlated with the model.</li>
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </Tabs>
            )}
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}
