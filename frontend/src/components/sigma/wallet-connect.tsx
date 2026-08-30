"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { animate, spring } from "animejs";
import { Wallet, Copy, Check, ExternalLink, LogOut, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface WalletState {
  address: string | null;
  chainId: number | null;
  connected: boolean;
}

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function getEth() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.ethereum as { request: (args: { method: string; params?: unknown[] }) => Promise<unknown>; on: (event: string, handler: (...args: unknown[]) => void) => void; removeListener: (event: string, handler: (...args: unknown[]) => void) => void } | undefined;
}

async function connectToMetaMask(): Promise<WalletState> {
  const eth = getEth();
  if (typeof window === "undefined" || !eth) {
    throw new Error("No wallet detected. Install MetaMask or another wallet.");
  }
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  const chainId = (await eth.request({ method: "eth_chainId" })) as string;
  return {
    address: accounts[0],
    chainId: parseInt(chainId, 16),
    connected: true,
  };
}

async function switchToSomnia(): Promise<void> {
  const eth = getEth();
  if (!eth) return;
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xC488" }],
    });
  } catch (e: unknown) {
    if ((e as { code?: number }).code === 4902) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0xC488",
            chainName: "Somnia Shannon Testnet",
            nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
            rpcUrls: ["https://dream-rpc.somnia.network"],
            blockExplorerUrls: ["https://shannon.explorer.somnia.network"],
          },
        ],
      });
    }
  }
}

export function WalletConnect() {
  const [wallet, setWallet] = useState<WalletState>({ address: null, chainId: null, connected: false });
  const [connecting, setConnecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const eth = getEth();
    if (typeof window !== "undefined" && eth) {
      eth.request({ method: "eth_accounts" })
        .then((accounts) => {
          const accs = accounts as string[];
          if (accs.length > 0) {
            eth.request({ method: "eth_chainId" }).then((cid) => {
              setWallet({ address: accs[0], chainId: parseInt(cid as string, 16), connected: true });
            });
          }
        })
        .catch(() => {});

      const handleAccountsChanged = (...args: unknown[]) => {
        const accs = args[0] as string[];
        if (accs.length === 0) {
          setWallet({ address: null, chainId: null, connected: false });
        } else {
          setWallet((prev) => ({ ...prev, address: accs[0], connected: true }));
        }
      };
      const handleChainChanged = (...args: unknown[]) => {
        setWallet((prev) => ({ ...prev, chainId: parseInt(args[0] as string, 16) }));
      };
      eth.on("accountsChanged", handleAccountsChanged);
      eth.on("chainChanged", handleChainChanged);
      return () => {
        eth.removeListener("accountsChanged", handleAccountsChanged);
        eth.removeListener("chainChanged", handleChainChanged);
      };
    }
  }, []);

  // Button hover animation
  useEffect(() => {
    const el = btnRef.current;
    if (!el) return;
    const enter = () => animate(el, { scale: [1, 1.04], duration: 200, ease: spring({ stiffness: 400, damping: 20 }) });
    const leave = () => animate(el, { scale: [1.04, 1], duration: 200, ease: "outQuad" });
    el.addEventListener("mouseenter", enter);
    el.addEventListener("mouseleave", leave);
    return () => { el.removeEventListener("mouseenter", enter); el.removeEventListener("mouseleave", leave); };
  }, [wallet.connected]);

  // Dropdown animation
  useEffect(() => {
    if (showDropdown && dropdownRef.current) {
      const items = dropdownRef.current.querySelectorAll("button, a");
      animate(items, {
        opacity: [0, 1],
        translateX: [-6, 0],
        duration: 250,
        delay: (i: number) => i * 40,
        ease: "outExpo",
      });
    }
  }, [showDropdown]);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    try {
      const state = await connectToMetaMask();
      setWallet(state);
      if (state.chainId !== 50312) {
        await switchToSomnia();
        setWallet((prev) => ({ ...prev, chainId: 50312 }));
      }
    } catch (err) {
      console.error("Wallet connection failed:", err);
    } finally {
      setConnecting(false);
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    setWallet({ address: null, chainId: null, connected: false });
    setShowDropdown(false);
  }, []);

  const copyAddress = useCallback(() => {
    if (wallet.address) {
      navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [wallet.address]);

  const isSomnia = wallet.chainId === 50312;

  if (!wallet.connected || !wallet.address) {
    return (
      <button
        ref={btnRef}
        onClick={handleConnect}
        disabled={connecting}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all duration-200 disabled:opacity-50"
      >
        <Wallet className={`w-3.5 h-3.5 ${connecting ? "animate-pulse" : ""}`} />
        {connecting ? "Connecting..." : "Connect Wallet"}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-card border border-border hover:border-primary/30 transition-all duration-200"
      >
        <span className={`w-2 h-2 rounded-full ${isSomnia ? "bg-positive" : "bg-yellow-500"}`} />
        <span className="font-mono text-foreground">{shortAddress(wallet.address)}</span>
      </button>

      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-2 w-64 sigma-card p-3 z-50"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted-foreground">Connected</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${isSomnia ? "bg-positive/10 text-positive" : "bg-yellow-500/10 text-yellow-500"}`}>
              {isSomnia ? "Somnia" : `Chain ${wallet.chainId}`}
            </span>
          </div>

          <div className="flex items-center gap-2 mb-3 p-2 bg-secondary/50 rounded-md">
            <span className="font-mono text-xs text-foreground truncate flex-1">{wallet.address}</span>
            <button onClick={copyAddress} className="shrink-0 p-1 hover:bg-secondary rounded transition-colors">
              {copied ? <Check className="w-3 h-3 text-positive" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
            </button>
          </div>

          {!isSomnia && (
            <button
              onClick={async () => { await switchToSomnia(); setWallet((prev) => ({ ...prev, chainId: 50312 })); }}
              className="w-full mb-2 px-3 py-1.5 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              Switch to Somnia
            </button>
          )}

          {showQR && wallet.address && (
            <div className="flex justify-center mb-3 p-3 bg-white rounded-lg">
              <QRCodeSVG value={wallet.address} size={120} level="M" />
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setShowQR(!showQR)}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
            >
              <QrCode className="w-3 h-3" />
              {showQR ? "Hide" : "QR"}
            </button>
            <a
              href={`https://shannon.explorer.somnia.network/address/${wallet.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Explorer
            </a>
            <button
              onClick={handleDisconnect}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-xs text-negative/80 hover:text-negative hover:bg-negative/10 transition-colors"
            >
              <LogOut className="w-3 h-3" />
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
