"use client";

import { useState, useRef, useEffect } from "react";
import { animate, spring } from "animejs";
import { Play, Square, Coins, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";

type BotStatus = "idle" | "running" | "stopping";

export function BotControls() {
  const [status, setStatus] = useState<BotStatus>("idle");
  const [showDropdown, setShowDropdown] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Button hover
  useEffect(() => {
    const el = btnRef.current;
    if (!el) return;
    const enter = () => animate(el, { scale: [1, 1.05], duration: 200, ease: spring({ stiffness: 400, damping: 20 }) });
    const leave = () => animate(el, { scale: [1.05, 1], duration: 200, ease: "outQuad" });
    el.addEventListener("mouseenter", enter);
    el.addEventListener("mouseleave", leave);
    return () => { el.removeEventListener("mouseenter", enter); el.removeEventListener("mouseleave", leave); };
  }, []);

  // Dropdown animation
  useEffect(() => {
    if (showDropdown && dropdownRef.current) {
      const items = dropdownRef.current.querySelectorAll("button");
      animate(items, {
        opacity: [0, 1],
        translateX: [-8, 0],
        duration: 250,
        delay: (i: number) => i * 50,
        ease: "outExpo",
      });
    }
  }, [showDropdown]);

  const handleStart = async () => {
    setStatus("running");
    toast.success("Bot started", { description: "ec-sigma is now scanning for edges" });
    setShowDropdown(false);
  };

  const handleStop = async () => {
    setStatus("stopping");
    setTimeout(() => {
      setStatus("idle");
      toast.info("Bot stopped", { description: "All orders cancelled, positions pending settlement" });
    }, 800);
    setShowDropdown(false);
  };

  const handleClaim = async () => {
    toast.info("Claiming settlements...", { description: "Checking for settled positions" });
    setShowDropdown(false);
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setShowDropdown(!showDropdown)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ${
          status === "running"
            ? "bg-positive/10 text-positive border-positive/20 shadow-[0_0_12px_rgba(77,190,149,0.15)]"
            : status === "stopping"
            ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
            : "bg-card text-muted-foreground border-border hover:border-primary/30"
        }`}
      >
        {status === "running" ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-positive animate-pulse" />
            Live
          </>
        ) : status === "stopping" ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            Stopping
          </>
        ) : (
          <>
            <Play className="w-3 h-3" />
            Bot
          </>
        )}
        <ChevronDown className="w-3 h-3" />
      </button>

      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-2 w-48 sigma-card p-2 z-50"
        >
          {status === "idle" ? (
            <button
              onClick={handleStart}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-positive hover:bg-positive/10 transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              Start Bot
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-negative hover:bg-negative/10 transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
              Stop Bot
            </button>
          )}
          <button
            onClick={handleClaim}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            <Coins className="w-3.5 h-3.5" />
            Claim Settlements
          </button>
        </div>
      )}
    </div>
  );
}
