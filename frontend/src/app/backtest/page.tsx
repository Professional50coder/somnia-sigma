"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, AlertTriangle } from "lucide-react";
import { SigmaNav } from "@/components/sigma/sigma-nav";

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

export default function BacktestPage() {
  const [results, setResults] = useState<BacktestResults | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/backtest");
        if (res.ok) {
          setResults(await res.json());
        }
      } catch {
        // keep null
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: "#070709" }}>
      <SigmaNav />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto px-6 py-6" style={{ maxWidth: "1200px" }}>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
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
              <div className="text-center py-12">
                <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-2 animate-pulse" />
                <p className="text-sm text-muted-foreground">Loading backtest results...</p>
              </div>
            ) : !results ? (
              <div className="text-center py-12">
                <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No backtest results found. Run the backtest first.</p>
              </div>
            ) : (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  <div className="sigma-card p-3">
                    <div className="sigma-label mb-1">Brier Score</div>
                    <div className="font-mono text-lg font-semibold text-foreground">
                      {results.brier.toFixed(4)}
                    </div>
                  </div>
                  <div className="sigma-card p-3">
                    <div className="sigma-label mb-1">Log Loss</div>
                    <div className="font-mono text-lg font-semibold text-foreground">
                      {results.logloss.toFixed(4)}
                    </div>
                  </div>
                  <div className="sigma-card p-3">
                    <div className="sigma-label mb-1">Checkpoints</div>
                    <div className="font-mono text-lg font-semibold text-foreground">
                      {results.totalCheckpoints.toLocaleString()}
                    </div>
                  </div>
                  <div className="sigma-card p-3">
                    <div className="sigma-label mb-1">BTC Bars</div>
                    <div className="font-mono text-lg font-semibold text-foreground">
                      {results.totalBars.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Calibration curve */}
                <div className="sigma-card p-5 mb-6">
                  <h3 className="text-sm font-medium text-foreground mb-4">Calibration Curve — Predicted vs Realised</h3>
                  <div className="space-y-2">
                    {results.calibration.map((b) => {
                      const gap = b.meanPredicted - b.realisedFreq;
                      const barWidth = Math.max(2, b.realisedFreq * 100);
                      return (
                        <div key={b.bucket} className="flex items-center gap-3 text-xs font-mono">
                          <span className="w-6 text-right text-muted-foreground">{b.bucket}</span>
                          <div className="flex-1 relative h-4 bg-secondary/50 rounded overflow-hidden">
                            <div
                              className="absolute left-0 top-0 h-full bg-primary/60 rounded"
                              style={{ width: `${barWidth}%` }}
                            />
                            <div
                              className="absolute left-0 top-0 h-full border-r-2 border-accent"
                              style={{ width: `${Math.max(2, b.meanPredicted * 100)}%` }}
                            />
                          </div>
                          <span className="w-16 text-right text-muted-foreground">
                            {(b.meanPredicted * 100).toFixed(1)}%
                          </span>
                          <span className="w-16 text-right text-foreground">
                            {(b.realisedFreq * 100).toFixed(1)}%
                          </span>
                          <span className={`w-16 text-right ${gap > 0 ? "text-negative" : "text-positive"}`}>
                            {gap > 0 ? "+" : ""}{(gap * 100).toFixed(1)}%
                          </span>
                          <span className="w-12 text-right text-muted-foreground">
                            n={b.n}
                          </span>
                        </div>
                      );
                    })}
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

                {/* Tail overconfidence warning */}
                <div className="sigma-card p-4 mb-6 border-l-2 border-yellow-500">
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

                {/* Tau buckets */}
                <div className="sigma-card overflow-hidden mb-6">
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
                      </tr>
                    </thead>
                    <tbody>
                      {results.tauBuckets.map((b) => (
                        <tr key={b.label} className="border-b border-border/50">
                          <td className="px-4 py-2.5 text-foreground">{b.label}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{b.n}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-foreground">{(b.meanPredicted * 100).toFixed(1)}%</td>
                          <td className="px-4 py-2.5 text-right font-mono text-foreground">{(b.realisedFreq * 100).toFixed(1)}%</td>
                          <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{b.brier.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* By cadence */}
                <div className="sigma-card overflow-hidden mb-6">
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
                      {results.byCadence.map((b) => (
                        <tr key={b.cadence} className="border-b border-border/50">
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

                {/* Assumptions */}
                <div className="sigma-card p-4">
                  <h3 className="text-sm font-medium text-foreground mb-2">Assumptions & Limitations</h3>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>~2 days of BTC/USDC M1 candles (3,000 bars). Directional evidence, not a large-sample proof.</li>
                    <li>~230 independent windows (not 5,620 — checkpoints within a window share settlement outcome).</li>
                    <li>Volatility: single continuous EWMA (λ converted by half-life, not copied raw).</li>
                    <li>Model: Φ(d₂) zero-drift GBM, terminal settlement. Known to understate fat tails.</li>
                    <li>Policy simulation discarded — synthetic book proxy was self-correlated with the model.</li>
                  </ul>
                </div>
              </>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
