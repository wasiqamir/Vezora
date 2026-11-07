"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AccountStatCounts = {
  logos: number;
  saves: number;
  shared: number;
};

/** Live Logos / Saves / Shared — refreshes on focus and while the account page stays open. */
export function AccountStats({ initial }: { initial: AccountStatCounts }) {
  const router = useRouter();
  const [stats, setStats] = useState(initial);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/account/stats", { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) return;
      const body = (await response.json()) as { stats?: AccountStatCounts };
      if (!body.stats) return;
      setStats((previous) => {
        const next = body.stats!;
        if (
          previous.logos !== next.logos ||
          previous.saves !== next.saves ||
          previous.shared !== next.shared
        ) {
          router.refresh();
        }
        return next;
      });
    } catch {
      // Keep the last known counts if the request fails.
    }
  }, [router]);

  useEffect(() => {
    setStats(initial);
  }, [initial.logos, initial.saves, initial.shared]);

  useEffect(() => {
    void load();
    function onVisible() {
      if (document.visibilityState === "visible") void load();
    }
    function onFocus() {
      void load();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => void load(), 5_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [load]);

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <StatCard label="Logos" value={String(stats.logos)} accent="text-[#67e8f9]" />
      <StatCard label="Saves" value={String(stats.saves)} accent="text-[#d8b4fe]" />
      <StatCard label="Shared" value={String(stats.shared)} accent="text-[#fdba74]" />
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="home-card rounded-[1.5rem] border border-white/10 bg-white/[0.03] px-5 py-4">
      <p className="text-[11px] tracking-[0.22em] text-white/40 uppercase">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}
