"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SigmaLogo } from "@/components/icons/premonition-logo";
import { Activity, BarChart3, Trophy, Zap } from "lucide-react";

const navItems = [
  { href: "/", label: "Edge Radar", icon: Activity },
  { href: "/backtest", label: "Backtest", icon: BarChart3 },
  { href: "/track-record", label: "Track Record", icon: Trophy },
];

export function SigmaNav() {
  const pathname = usePathname();

  return (
    <header className="shrink-0 z-50" style={{ backgroundColor: "#070709", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="px-6 py-3">
        <div className="flex items-center justify-between gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <SigmaLogo size={32} />
            <span className="text-lg font-semibold text-foreground tracking-tight">
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

          {/* Status */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
            <Zap className="w-3.5 h-3.5 text-accent" />
            <span className="hidden sm:inline">Somnia Testnet</span>
          </div>
        </div>
      </div>
    </header>
  );
}
