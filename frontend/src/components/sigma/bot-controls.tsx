"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Square, Coins, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";

type BotStatus = "idle" | "running" | "stopping";

export function BotControls() {
  const [status, setStatus] = useState<BotStatus>("idle");
  const [showDropdown, setShowDropdown] = useState(false);

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
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
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
      </motion.button>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
