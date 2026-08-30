"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { animate, stagger, spring } from "animejs";
import {
  Activity, TrendingUp, Zap, Shield, BarChart3, Target, ChevronRight,
  ExternalLink, ArrowRight, Globe, Code2, Cpu, LineChart, CheckCircle2,
  AlertTriangle, Clock, DollarSign, Eye, ArrowUpRight,
} from "lucide-react";
import { SigmaLogo } from "@/components/icons/premonition-logo";

const CHAIN = "https://shannon-explorer.somnia.network";

const contracts = [
  { name: "RealizedVol", addr: "0xbd7eedfa178d8eb094449e3461e83195f4b062ef", desc: "On-chain EWMA volatility accumulator" },
  { name: "SigmaOracle", addr: "0xe4c7be7dca5f536cfb18df61b01f3a952e902270", desc: "Fair-value oracle: Φ(d₂) edge, kelly, break-even" },
  { name: "SigmaWindowRegistry", addr: "0x16b9d8c364d70f38d0b04b760439efc794a46731", desc: "Window metadata: opening price, expiry, interval" },
  { name: "SigmaCron", addr: "0xc573c7b699690d1821aa4156ef7c09ee9ceba0e7", desc: "Window boundary scheduler" },
  { name: "SigmaReactiveVol", addr: "0x5f6a29b5717841f6f7b394be6936ea176dc63d28", desc: "Reactive volatility delivery wrapper" },
];

const proofs = [
  { title: "Price Push — $78,054", tx: "0x5a3aa8ad4116c37461950fee031fc1e9080fb4a603f626f0bba32fa1cc53cee2", desc: "BTC price recorded on-chain via RealizedVol.recordPrice" },
  { title: "Writer Authorization", tx: "0xcd1ea9e4d57be9893a027f112f9dc708cf31e0ff875b00e7df65e9aa161840d7", desc: "setWriter — deployer wallet authorized for price feed" },
  { title: "Funded Bot Wallet", tx: "0x9ea423174e8eb5176f8329edf07402d58178ee7ef88441d25f5e015a81145b7d", desc: "25 STT transferred from Bot to Deployer for gas" },
  { title: "RealizedVol Deploy", tx: "0x0935f529d024352ad408abe4396ba239195748339adfe5f3d0624b1269700436", desc: "Contract deployment — 11.7M gas" },
  { title: "SigmaOracle Deploy", tx: "0xd4e181e9ba7086ece672a6660c20c50970335d1173d3e6f030f3d64dc35bed0e", desc: "Fair-value oracle deployment — 21.1M gas" },
];

const kpis = [
  { value: 428, label: "On-chain Samples", suffix: "", icon: BarChart3, color: "#54BBF7" },
  { value: 5, label: "Deployed Contracts", suffix: "", icon: Shield, color: "#4DBE95" },
  { value: 111, label: "Hardhat Tests", suffix: "", icon: CheckCircle2, color: "#6166DC" },
  { value: 54, label: "Avg Edge (bps)", suffix: "+", icon: TrendingUp, color: "#4DBE95" },
  { value: 20.6, label: "Student-t Improvement", suffix: "%", icon: Target, color: "#C27C58" },
  { value: 78054, label: "BTC Spot Price", suffix: "", icon: DollarSign, color: "#54BBF7", prefix: "$" },
];

/* ─── Anime.js animated counter ─── */
function Counter({ value, suffix = "", prefix = "" }: { value: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const played = useRef(false);

  useEffect(() => {
    if (!ref.current || played.current) return;
    const el = ref.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !played.current) {
          played.current = true;
          const obj = { val: 0 };
          animate(obj, {
            val: value,
            duration: 1800,
            ease: "outExpo",
            onUpdate: () => {
              if (!el) return;
              if (value >= 1000) el.textContent = `${prefix}${Math.round(obj.val).toLocaleString()}${suffix}`;
              else if (value % 1 !== 0) el.textContent = `${prefix}${obj.val.toFixed(1)}${suffix}`;
              else el.textContent = `${prefix}${Math.round(obj.val)}${suffix}`;
            },
          });
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value, suffix, prefix]);

  return <span ref={ref}>{prefix}0{suffix}</span>;
}

/* ─── Anime.js stagger reveal ─── */
function RevealChildren({ className, children, delay = 80 }: { className?: string; children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const played = useRef(false);

  useEffect(() => {
    if (!ref.current || played.current) return;
    const el = ref.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !played.current) {
          played.current = true;
          const items = el.querySelectorAll("[data-reveal]");
          animate(items, {
            opacity: [0, 1],
            translateY: [40, 0],
            scale: [0.96, 1],
            duration: 700,
            delay: stagger(delay),
            ease: "outExpo",
          });
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return <div ref={ref} className={className}>{children}</div>;
}

/* ─── Anime.js stagger list ─── */
function StaggerList({ className, items, renderItem }: { className?: string; items: unknown[]; renderItem: (item: unknown, i: number) => React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const played = useRef(false);

  useEffect(() => {
    if (!ref.current || played.current) return;
    const el = ref.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !played.current) {
          played.current = true;
          const children = el.querySelectorAll("[data-stagger]");
          animate(children, {
            opacity: [0, 1],
            translateX: [-24, 0],
            duration: 550,
            delay: stagger(60),
            ease: "outExpo",
          });
          observer.disconnect();
        }
      },
      { threshold: 0.08 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [items.length]);

  return (
    <div ref={ref} className={className}>
      {items.map((item, i) => (
        <div key={i} data-stagger style={{ opacity: 0 }}>
          {renderItem(item, i)}
        </div>
      ))}
    </div>
  );
}

/* ─── Continuously animating sigma wave (anime.js) ─── */
function SigmaWave() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    let t = 0;
    const draw = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.lineWidth = 1;
      for (let y = 0; y < h; y += 16) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }

      // Multi-layer wave
      const layers = [
        { amp: 15, freq: 0.018, speed: 0.7, color: "#54BBF7", width: 2.5, alpha: 1 },
        { amp: 10, freq: 0.012, speed: 0.4, color: "#4DBE95", width: 1.5, alpha: 0.5 },
        { amp: 6, freq: 0.03, speed: 1.2, color: "#6166DC", width: 1, alpha: 0.3 },
      ];

      for (const layer of layers) {
        const grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, layer.color + "00");
        grad.addColorStop(0.2, layer.color);
        grad.addColorStop(0.8, layer.color);
        grad.addColorStop(1, layer.color + "00");

        ctx.strokeStyle = grad;
        ctx.lineWidth = layer.width;
        ctx.globalAlpha = layer.alpha;
        ctx.beginPath();
        for (let x = 0; x < w; x++) {
          const y = h / 2 +
            Math.sin(x * layer.freq + t * layer.speed) * layer.amp +
            Math.sin(x * layer.freq * 2.3 + t * layer.speed * 1.7) * (layer.amp * 0.4);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Fill
        ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
        const fillGrad = ctx.createLinearGradient(0, h * 0.3, 0, h);
        fillGrad.addColorStop(0, layer.color + "15");
        fillGrad.addColorStop(1, layer.color + "00");
        ctx.fillStyle = fillGrad;
        ctx.fill();
      }

      ctx.globalAlpha = 1;

      // Tracking dot
      const dotX = (t * 45) % w;
      const dotY = h / 2 +
        Math.sin(dotX * 0.018 + t * 0.7) * 15 +
        Math.sin(dotX * 0.012 + t * 0.4) * 10;

      // Pulse ring
      const pulseR = 6 + Math.sin(t * 3) * 3;
      ctx.beginPath();
      ctx.arc(dotX, dotY, pulseR + 6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(84,187,247,0.1)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(dotX, dotY, pulseR, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(84,187,247,0.3)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#54BBF7";
      ctx.fill();

      t += 0.016;
      frameRef.current = requestAnimationFrame(draw);
    };
    frameRef.current = requestAnimationFrame(draw);

    return () => { cancelAnimationFrame(frameRef.current); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}

/* ─── Calibration chart with anime.js ─── */
function CalibrationChart() {
  const ref = useRef<HTMLDivElement>(null);
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const predicted = [14.1, 22.4, 30.6, 35.9, 42.3, 40.9, 51.4, 60.7, 76.7, 91.5];
  const realised = [0.2, 6.4, 19.9, 32.1, 41.2, 49.9, 59.6, 72.1, 89.4, 99.6];
  const played = useRef(false);
  const [pulsePhase, setPulsePhase] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPulsePhase(p => (p + 1) % 10), 1500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!ref.current || played.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !played.current) {
          played.current = true;

          // Animate bars
          const realBars = ref.current!.querySelectorAll("[data-real]");
          const predBars = ref.current!.querySelectorAll("[data-pred]");

          realBars.forEach((bar, i) => {
            const target = Math.max(2, parseFloat(bar.getAttribute("data-real")!));
            setTimeout(() => {
              animate(bar, {
                width: `${target}%`,
                opacity: [0, 1],
                duration: 800,
                ease: "outExpo",
              });
            }, i * 60);
          });

          predBars.forEach((bar, i) => {
            const target = Math.max(2, parseFloat(bar.getAttribute("data-pred")!));
            setTimeout(() => {
              animate(bar, {
                width: `${target}%`,
                opacity: [0, 1],
                duration: 800,
                ease: "outExpo",
              });
            }, i * 60 + 100);
          });

          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="space-y-1.5">
      {predicted.map((pred, i) => {
        const real = realised[i];
        const diff = pred - real;
        return (
          <div key={i} className="flex items-center gap-2 text-[11px] font-mono">
            <span className="w-4 text-right text-muted-foreground">{i}</span>
            <div className="flex-1 relative h-4 bg-secondary/50 rounded overflow-hidden">
              <div
                data-real={real}
                className="absolute left-0 top-0 h-full bg-primary/50 rounded"
                style={{ width: 0 }}
              />
              <div
                data-pred={pred}
                className="absolute left-0 top-0 h-full border-r-2 border-accent"
                style={{ width: 0 }}
              />
              {/* Pulse indicator */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-accent transition-all duration-500"
                style={{ left: `${pred}%`, opacity: pulsePhase === i ? 1 : 0.2 }}
              />
            </div>
            <span className="w-12 text-right text-muted-foreground">{pred.toFixed(0)}%</span>
            <span className="w-12 text-right text-foreground">{real.toFixed(0)}%</span>
            <span className={`w-14 text-right font-medium ${diff > 5 ? "text-negative" : diff < -5 ? "text-positive" : "text-muted-foreground"}`}>
              {diff > 0 ? "+" : ""}{diff.toFixed(0)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Animated data flow particles (anime.js) ─── */
function DataFlowParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    interface Particle {
      x: number; y: number; vx: number; vy: number;
      size: number; color: string; life: number; maxLife: number;
      trail: { x: number; y: number }[];
    }

    const particles: Particle[] = [];
    const colors = ["#54BBF7", "#4DBE95", "#6166DC", "#C27C58"];
    let t = 0;

    const spawn = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const color = colors[Math.floor(Math.random() * colors.length)];
      particles.push({
        x: -10,
        y: h * 0.2 + Math.random() * h * 0.6,
        vx: 2 + Math.random() * 3,
        vy: (Math.random() - 0.5) * 0.8,
        size: 1 + Math.random() * 2.5,
        color,
        life: 0,
        maxLife: 250 + Math.random() * 250,
        trail: [],
      });
    };

    const draw = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);

      if (t % 6 === 0 && particles.length < 80) spawn();

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 12) p.trail.shift();

        p.x += p.vx;
        p.y += p.vy + Math.sin(t * 0.04 + i * 0.5) * 0.3;
        p.life++;

        const alpha = Math.min(1, p.life / 30) * Math.max(0, 1 - p.life / p.maxLife);

        // Trail
        if (p.trail.length > 1) {
          for (let j = 1; j < p.trail.length; j++) {
            const ta = alpha * (j / p.trail.length) * 0.4;
            ctx.beginPath();
            ctx.moveTo(p.trail[j - 1].x, p.trail[j - 1].y);
            ctx.lineTo(p.trail[j].x, p.trail[j].y);
            ctx.strokeStyle = p.color + Math.round(ta * 255).toString(16).padStart(2, "0");
            ctx.lineWidth = p.size * 0.4;
            ctx.stroke();
          }
        }

        // Glow
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
        glow.addColorStop(0, p.color + Math.round(alpha * 80).toString(16).padStart(2, "0"));
        glow.addColorStop(1, p.color + "00");
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.round(alpha * 255).toString(16).padStart(2, "0");
        ctx.fill();

        if (p.life > p.maxLife || p.x > w + 20) particles.splice(i, 1);
      }

      t++;
      frameRef.current = requestAnimationFrame(draw);
    };
    frameRef.current = requestAnimationFrame(draw);

    return () => { cancelAnimationFrame(frameRef.current); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />;
}

/* ─── Live price ticker ─── */
function LiveTicker() {
  const ref = useRef<HTMLSpanElement>(null);
  const [price, setPrice] = useState(78054);

  useEffect(() => {
    const id = setInterval(() => {
      setPrice(prev => {
        const next = prev + Math.round((Math.random() - 0.48) * 25);
        if (ref.current) {
          animate(ref.current, {
            color: next > prev ? ["#4DBE95", "#EEF0F1"] : ["#D84F68", "#EEF0F1"],
            duration: 600,
            ease: "outQuad",
          });
        }
        return next;
      });
    }, 2500);
    return () => clearInterval(id);
  }, []);

  return <span ref={ref} className="font-mono text-foreground">${price.toLocaleString()}</span>;
}

/* ─── Animated flow diagram ─── */
function FlowDiagram() {
  const ref = useRef<HTMLDivElement>(null);
  const played = useRef(false);

  useEffect(() => {
    if (!ref.current || played.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !played.current) {
          played.current = true;

          const nodes = ref.current!.querySelectorAll("[data-node]");
          const lines = ref.current!.querySelectorAll("[data-line]");

          // Animate nodes in
          animate(nodes, {
            opacity: [0, 1],
            scale: [0.7, 1],
            duration: 600,
            delay: stagger(150, { start: 200 }),
            ease: spring({ stiffness: 300, damping: 20 }),
          });

          // Animate flow lines
          animate(lines, {
            scaleX: [0, 1],
            duration: 500,
            delay: stagger(150, { start: 100 }),
            ease: "outExpo",
          });

          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const steps = [
    { label: "dreamDEX", sub: "MarkPriceUpdated", color: "#D84F68", icon: Activity },
    { label: "RealizedVol", sub: "EWMA σ on-chain", color: "#54BBF7", icon: Cpu },
    { label: "SigmaOracle", sub: "Φ(d₂) fair value", color: "#4DBE95", icon: LineChart },
    { label: "Edge Radar", sub: "Reads fair value", color: "#6166DC", icon: Eye },
  ];

  return (
    <div ref={ref} className="relative flex items-center justify-between gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex-1 h-px relative overflow-hidden" data-line style={{ transformOrigin: "left" }}>
          <div className="absolute inset-0 bg-border" />
          <div
            className="absolute top-0 left-0 h-full w-12 animate-[flow_1.5s_linear_infinite]"
            style={{
              background: `linear-gradient(90deg, transparent, ${steps[i].color}80, transparent)`,
              animationDelay: `${i * 0.3}s`,
            }}
          />
        </div>
      ))}
      {steps.map((s, i) => (
        <div key={s.label} data-node style={{ opacity: 0 }} className="relative z-10 shrink-0">
          <div
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl flex flex-col items-center justify-center border transition-all duration-300 hover:scale-105"
            style={{ borderColor: s.color + "40", backgroundColor: s.color + "10" }}
          >
            <s.icon className="w-5 h-5 mb-1" style={{ color: s.color }} />
            <span className="text-[10px] font-semibold text-foreground text-center leading-tight">{s.label}</span>
            <span className="text-[8px] text-muted-foreground text-center leading-tight mt-0.5 hidden sm:block">{s.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -80]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0]);

  // Hero text scramble
  const taglineRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!taglineRef.current) return;
    const el = taglineRef.current;
    const text = "tells you the odds.";
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    let iteration = 0;
    const id = setInterval(() => {
      el.textContent = text
        .split("")
        .map((ch, i) => (i < iteration ? ch : ch === " " ? " " : chars[Math.floor(Math.random() * chars.length)]))
        .join("");
      iteration += 0.5;
      if (iteration >= text.length) { el.textContent = text; clearInterval(id); }
    }, 40);
    return () => clearInterval(id);
  }, []);

  // Nav link hover animations
  useEffect(() => {
    const links = document.querySelectorAll("[data-nav-link]");
    links.forEach((link) => {
      const enter = () => {
        animate(link, { scale: [1, 1.05], duration: 200, ease: "outQuad" });
      };
      const leave = () => {
        animate(link, { scale: [1.05, 1], duration: 200, ease: "outQuad" });
      };
      link.addEventListener("mouseenter", enter);
      link.addEventListener("mouseleave", leave);
    });
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#070709" }}>
      <style>{`@keyframes flow { 0% { transform: translateX(-48px); } 100% { transform: translateX(calc(100% + 48px)); } }`}</style>

      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl" style={{ backgroundColor: "rgba(7,7,9,0.85)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="mx-auto px-6 py-3 flex items-center justify-between" style={{ maxWidth: "1400px" }}>
          <Link href="/" className="flex items-center gap-2.5">
            <SigmaLogo size={28} />
            <span className="text-lg font-semibold text-foreground tracking-tight">Sigma</span>
          </Link>
          <nav className="flex items-center gap-1">
            {[
              { href: "/edge-radar", label: "Edge Radar", icon: Activity },
              { href: "/backtest", label: "Backtest", icon: BarChart3 },
              { href: "/track-record", label: "Track Record", icon: TrendingUp },
            ].map((item) => (
              <Link key={item.href} href={item.href} data-nav-link className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <a href={`${CHAIN}/address/0xe4c7be7dca5f536cfb18df61b01f3a952e902270`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono text-muted-foreground hover:text-foreground border border-border hover:border-primary/30 transition-all">
              <Globe className="w-3 h-3" /> 50312
            </a>
            <Link href="/edge-radar" data-nav-link className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
              Launch <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ═══ HERO ═══ */}
      <motion.section ref={heroRef} style={{ y: heroY, opacity: heroOpacity }} className="relative pt-32 pb-16 px-6 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        <motion.div className="absolute top-20 left-1/4 w-96 h-96 rounded-full opacity-20 blur-[120px]" style={{ background: "radial-gradient(circle, #54BBF7 0%, transparent 70%)" }} animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 8, repeat: Infinity }} />
        <motion.div className="absolute top-40 right-1/4 w-80 h-80 rounded-full opacity-15 blur-[100px]" style={{ background: "radial-gradient(circle, #4DBE95 0%, transparent 70%)" }} animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 10, repeat: Infinity }} />

        <div className="mx-auto relative" style={{ maxWidth: "1000px" }}>
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}>
            <div className="flex items-center gap-2 mb-6">
              <motion.span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20" animate={{ boxShadow: ["0 0 0 0 rgba(84,187,247,0)", "0 0 12px 2px rgba(84,187,247,0.3)", "0 0 0 0 rgba(84,187,247,0)"] }} transition={{ duration: 2, repeat: Infinity }}>
                Live on Shannon
              </motion.span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-accent/10 text-accent border border-accent/20">Chain 50312</span>
            </div>

            <h1 className="text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight mb-6" style={{ lineHeight: 1.02 }}>
              <span className="text-foreground">Sigma</span>
              <br />
              <span ref={taglineRef} className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent" />
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mb-4 leading-relaxed">
              The fair-value layer for dreamDEX Event Contracts on Somnia.
              On-chain volatility, closed-form pricing, real-time edge detection.
            </p>
            <p className="text-sm text-muted-foreground/70 max-w-2xl mb-8 font-mono">
              Φ(d₂) = fair probability &middot; Edge = fair − book &middot; Kelly = optimal size &middot; All on-chain
            </p>

            <div className="flex items-center gap-3">
              <Link href="/edge-radar" className="group flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
                Open Edge Radar
                <motion.span className="inline-block" animate={{ x: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Infinity }}><ArrowRight className="w-4 h-4" /></motion.span>
              </Link>
              <a href="#proofs" className="flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-secondary/50 transition-colors">
                Verify on-chain <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* ═══ KPIs ═══ */}
      <section className="py-12 px-6 border-y border-border" style={{ backgroundColor: "rgba(16,17,22,0.5)" }}>
        <RevealChildren className="mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 max-w-[1400px]">
          {kpis.map((k, i) => (
            <div key={k.label} data-reveal className="sigma-card p-4 text-center cursor-default transition-all duration-200 hover:scale-[1.03] hover:-translate-y-0.5">
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <k.icon className="w-3.5 h-3.5" style={{ color: k.color }} />
              </div>
              <div className="text-2xl font-bold font-mono" style={{ color: k.color }}>
                <Counter value={k.value} suffix={k.suffix} prefix={k.prefix} />
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{k.label}</div>
            </div>
          ))}
        </RevealChildren>
      </section>

      {/* ═══ LIVE SIGMA CHART ═══ */}
      <section className="py-16 px-6">
        <div className="mx-auto" style={{ maxWidth: "1000px" }}>
          <RevealChildren className="mb-8">
            <div data-reveal>
              <span className="text-[11px] uppercase tracking-wider text-primary font-semibold mb-2 block">Live Volatility Feed</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">On-chain EWMA σ — continuously updating.</h2>
            </div>
          </RevealChildren>

          <div data-reveal className="sigma-card p-1 overflow-hidden" style={{ opacity: 0, height: "240px" }} ref={(el) => {
            if (el && !el.dataset.animated) {
              const observer = new IntersectionObserver(([e]) => {
                if (e.isIntersecting) {
                  el.dataset.animated = "true";
                  animate(el, { opacity: [0, 1], translateY: [20, 0], duration: 800, ease: "outExpo" });
                  observer.disconnect();
                }
              }, { threshold: 0.1 });
              observer.observe(el);
            }
          }}>
            <SigmaWave />
          </div>

          <div className="flex items-center gap-6 mt-3 text-xs font-mono text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary animate-pulse" /> σ = 0.0012</span>
            <span>samples: 428</span>
            <span className="flex items-center gap-1"><LiveTicker /></span>
            <span className="flex items-center gap-1.5 ml-auto"><span className="w-1.5 h-1.5 rounded-full bg-positive" /> VOL OK</span>
          </div>
        </div>
      </section>

      {/* ═══ DATA FLOW ═══ */}
      <section className="py-16 px-6 relative overflow-hidden" style={{ backgroundColor: "rgba(16,17,22,0.5)" }}>
        <DataFlowParticles />
        <div className="mx-auto relative" style={{ maxWidth: "1000px" }}>
          <RevealChildren className="mb-10">
            <div data-reveal>
              <span className="text-[11px] uppercase tracking-wider text-accent font-semibold mb-2 block">Data Flow</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">End-to-end on-chain pipeline.</h2>
              <p className="text-muted-foreground">Price events flow in. Fair value flows out. No API. No keeper. No off-chain dependency.</p>
            </div>
          </RevealChildren>
          <FlowDiagram />
        </div>
      </section>

      {/* ═══ PROBLEM ═══ */}
      <section className="py-20 px-6">
        <div className="mx-auto" style={{ maxWidth: "1000px" }}>
          <RevealChildren className="mb-12">
            <div data-reveal>
              <span className="text-[11px] uppercase tracking-wider text-negative font-semibold mb-2 block">The Problem</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Prediction markets price blind.</h2>
            </div>
          </RevealChildren>

          <StaggerList
            className="grid sm:grid-cols-3 gap-4"
            items={[
              { title: "No fair probability exists", desc: "dreamDEX's ec-maker quotes around fair probability — but nothing in the kit supplies that number.", icon: AlertTriangle, color: "#D84F68" },
              { title: "Book prices are guesswork", desc: "Displayed odds are promises, not proofs. The market maker can change the price the moment you need it.", icon: Eye, color: "#C27C58" },
              { title: "Volatility is off-chain", desc: "Realized vol lives in spreadsheets. No on-chain source exists for smart contracts to consume.", icon: Clock, color: "#D84F68" },
            ]}
            renderItem={(item) => {
              const p = item as { title: string; desc: string; icon: typeof AlertTriangle; color: string };
              return (
                <div className="sigma-card p-5 transition-all duration-200 hover:-translate-y-1" style={{ ["`--hover-border`" as string]: p.color + "40" }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: p.color + "15" }}>
                    <p.icon className="w-5 h-5" style={{ color: p.color }} />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">{p.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
                </div>
              );
            }}
          />
        </div>
      </section>

      {/* ═══ SOLUTION ═══ */}
      <section className="py-20 px-6" style={{ backgroundColor: "rgba(16,17,22,0.5)" }}>
        <div className="mx-auto" style={{ maxWidth: "1000px" }}>
          <RevealChildren className="mb-12">
            <div data-reveal>
              <span className="text-[11px] uppercase tracking-wider text-accent font-semibold mb-2 block">The Solution</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">On-chain vol → closed-form pricing → edge signal.</h2>
            </div>
          </RevealChildren>

          <StaggerList
            className="grid sm:grid-cols-3 gap-4 mb-8"
            items={[
              { title: "On-chain volatility feed", desc: "RealizedVol accumulates EWMA σ from dreamDEX MarkPriceUpdated events. 428 real BTC observations.", icon: Cpu, color: "#54BBF7" },
              { title: "Closed-form pricing", desc: "SigmaOracle computes Φ(d₂) — Black-Scholes fair probability — entirely on-chain.", icon: LineChart, color: "#4DBE95" },
              { title: "Edge detection", desc: "Fair probability minus book price = edge in basis points. Kelly fraction for optimal sizing.", icon: Target, color: "#6166DC" },
            ]}
            renderItem={(item) => {
              const s = item as { title: string; desc: string; icon: typeof Cpu; color: string };
              return (
                <div className="sigma-card p-5 transition-all duration-200 hover:-translate-y-1">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: s.color + "15" }}>
                    <s.icon className="w-5 h-5" style={{ color: s.color }} />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              );
            }}
          />

          <div data-reveal style={{ opacity: 0 }} ref={(el) => {
            if (el && !el.dataset.animated) {
              const observer = new IntersectionObserver(([e]) => {
                if (e.isIntersecting) {
                  el.dataset.animated = "true";
                  animate(el, { opacity: [0, 1], translateY: [20, 0], scale: [0.98, 1], duration: 800, ease: "outExpo" });
                  observer.disconnect();
                }
              }, { threshold: 0.2 });
              observer.observe(el);
            }
          }} className="sigma-card p-6 text-center">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3 block">The core math</span>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-foreground mb-2">
              d₂ = <span className="text-primary">ln(S / S₀) + ½σ²τ</span> / <span className="text-primary">σ√τ</span>
            </div>
            <div className="text-lg font-mono text-accent">Fair probability = Φ(d₂)</div>
            <p className="text-sm text-muted-foreground mt-3 max-w-lg mx-auto">σ from on-chain EWMA · τ from window metadata · S₀ from registry · Everything on-chain</p>
          </div>
        </div>
      </section>

      {/* ═══ CALIBRATION ═══ */}
      <section className="py-20 px-6">
        <div className="mx-auto" style={{ maxWidth: "1000px" }}>
          <RevealChildren className="mb-8">
            <div data-reveal>
              <span className="text-[11px] uppercase tracking-wider text-accent font-semibold mb-2 block">Backtest Calibration</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">3,000 BTC minute candles.</h2>
              <p className="text-muted-foreground">Bars = predicted frequency. Line = realised. Watch the pulse track calibration.</p>
            </div>
          </RevealChildren>

          <div className="sigma-card p-5">
            <div className="flex items-center gap-6 mb-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-primary/50 rounded" /> Realised</span>
              <span className="flex items-center gap-1.5"><span className="w-0.5 h-2 bg-accent" /> Predicted</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /> Live pulse</span>
            </div>
            <CalibrationChart />
          </div>

          <StaggerList className="grid sm:grid-cols-2 gap-4 mt-4" items={[0, 1]} renderItem={(item) => {
            const i = item as number;
            return i === 0 ? (
              <div className="sigma-card p-4">
                <h3 className="text-xs font-semibold text-foreground mb-2">Gaussian Model</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Brier score</span><span className="font-mono text-foreground">0.2071</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Log loss</span><span className="font-mono text-foreground">0.7426</span></div>
                </div>
              </div>
            ) : (
              <div className="sigma-card p-4 border-accent/30">
                <h3 className="text-xs font-semibold text-accent mb-2">Student-t (ν ≈ 5.2) ✦</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Brier score</span><span className="font-mono text-positive">0.2007 <span className="text-xs">(-3.1%)</span></span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Log loss</span><span className="font-mono text-positive">0.5898 <span className="text-xs">(-20.6%)</span></span></div>
                </div>
              </div>
            );
          }} />
        </div>
      </section>

      {/* ═══ ON-CHAIN PROOFS ═══ */}
      <section id="proofs" className="py-20 px-6" style={{ backgroundColor: "rgba(16,17,22,0.5)" }}>
        <div className="mx-auto" style={{ maxWidth: "1000px" }}>
          <RevealChildren className="mb-12">
            <div data-reveal>
              <span className="text-[11px] uppercase tracking-wider text-primary font-semibold mb-2 block">On-Chain Proofs</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Every number is verifiable.</h2>
              <p className="text-muted-foreground mt-2">Click any transaction. No wallets needed. No trust required.</p>
            </div>
          </RevealChildren>

          <StaggerList className="space-y-3" items={proofs} renderItem={(item) => {
            const p = item as typeof proofs[0];
            return (
              <a href={`${CHAIN}/tx/${p.tx}`} target="_blank" rel="noopener noreferrer" className="sigma-card p-4 flex items-center gap-4 group transition-all duration-200 hover:translate-x-1 hover:border-primary/30 block">
                <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">{p.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{p.desc}</div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <code className="text-[11px] font-mono text-muted-foreground hidden sm:block">{p.tx.slice(0, 10)}...{p.tx.slice(-6)}</code>
                  <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </a>
            );
          }} />
        </div>
      </section>

      {/* ═══ DEPLOYED CONTRACTS ═══ */}
      <section className="py-20 px-6">
        <div className="mx-auto" style={{ maxWidth: "1000px" }}>
          <RevealChildren className="mb-12">
            <div data-reveal>
              <span className="text-[11px] uppercase tracking-wider text-accent font-semibold mb-2 block">Deployed Contracts</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">5 contracts live on Shannon.</h2>
            </div>
          </RevealChildren>

          <StaggerList className="space-y-3" items={contracts} renderItem={(item) => {
            const c = item as typeof contracts[0];
            return (
              <a href={`${CHAIN}/address/${c.addr}`} target="_blank" rel="noopener noreferrer" className="sigma-card p-4 flex items-center gap-4 group transition-all duration-200 hover:translate-x-1 hover:border-accent/30 block">
                <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-accent/10 group-hover:bg-accent/20 transition-colors">
                  <Code2 className="w-4 h-4 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">{c.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{c.desc}</div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <code className="text-[11px] font-mono text-muted-foreground">{c.addr.slice(0, 6)}...{c.addr.slice(-4)}</code>
                  <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent transition-colors" />
                </div>
              </a>
            );
          }} />
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="py-20 px-6" style={{ backgroundColor: "rgba(16,17,22,0.5)" }}>
        <div className="mx-auto text-center" style={{ maxWidth: "700px" }}>
          <RevealChildren>
            <div data-reveal>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">The edge is on-chain.</h2>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">5 contracts deployed. 428 volatility samples. Fair probability computed in Solidity.</p>
              <div className="flex items-center justify-center gap-3">
                <Link href="/edge-radar" className="flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
                  Open Edge Radar <ArrowRight className="w-4 h-4" />
                </Link>
                <a href="https://github.com/Professional50coder/somnia-sigma" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-secondary/50 transition-colors">
                  <Code2 className="w-4 h-4" /> View Source
                </a>
              </div>
            </div>
          </RevealChildren>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 px-6 border-t border-border">
        <div className="mx-auto flex items-center justify-between" style={{ maxWidth: "1400px" }}>
          <div className="flex items-center gap-2">
            <SigmaLogo size={20} />
            <span className="text-sm font-semibold text-foreground">Sigma</span>
            <span className="text-xs text-muted-foreground">by Hitansh Gopani</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <a href="https://github.com/Professional50coder/somnia-sigma" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
            <a href="https://x.com/Hitansh54" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Twitter</a>
            <a href="mailto:hitansh.gopani@somaiya.edu" className="hover:text-foreground transition-colors">Email</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
