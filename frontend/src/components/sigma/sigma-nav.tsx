"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useEffect } from "react";
import { animate } from "animejs";
import { SigmaLogo } from "@/components/icons/premonition-logo";
import { Activity, BarChart3, Trophy, Zap } from "lucide-react";
import { WalletConnect } from "@/components/sigma/wallet-connect";
import { BotControls } from "@/components/sigma/bot-controls";
import { ThemeToggle } from "@/components/sigma/theme-toggle";

const navItems = [
  { href: "/", label: "Edge Radar", icon: Activity },
  { href: "/backtest", label: "Backtest", icon: BarChart3 },
  { href: "/track-record", label: "Track Record", icon: Trophy },
];

export function SigmaNav() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!navRef.current) return;
    const links = navRef.current.querySelectorAll("nav a");
    links.forEach((link) => {
      const enter = () => {
        animate(link, { scale: [1, 1.05], translateY: [0, -1], duration: 200, ease: "outQuad" });
      };
      const leave = () => {
        animate(link, { scale: [1.05, 1], translateY: [-1, 0], duration: 200, ease: "outQuad" });
      };
      link.addEventListener("mouseenter", enter);
      link.addEventListener("mouseleave", leave);
    });
  }, []);

  return (
    <header ref={navRef} className="shrink-0 z-50" style={{ backgroundColor: "#070709", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="px-6 py-3">
        <div className="flex items-center justify-between gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <SigmaLogo size={32} />
            <span className="text-lg font-semibold text-foreground tracking-tight group-hover:text-primary transition-colors">
              Sigma
            </span>
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground bg-secondary px-1.5 py-0.5 rounded hidden sm:inline">
              Somnia
            </span>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "text-foreground bg-secondary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right side: Bot + Wallet + Theme */}
          <div className="flex items-center gap-2 shrink-0">
            <BotControls />
            <WalletConnect />
            <ThemeToggle />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-1 pl-2 border-l border-border">
              <Zap className="w-3.5 h-3.5 text-accent" />
              <span className="hidden sm:inline">Somnia Testnet</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
