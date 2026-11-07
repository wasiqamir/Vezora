"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Droplet, Image as ImageIcon, Layers, PenTool, Type } from "lucide-react";
import { VezoraMark } from "@/components/vezora-mark";

const LOAD_MS = 6500;
const FADE_MS = 500;
const HOME_PATH = "/homepage";

/** True after splash has finished (or been skipped) in this tab. */
let splashBootstrapped = false;

export function SplashScreen() {
  const pathname = usePathname();
  const router = useRouter();
  const isEntry = pathname === "/";
  const barRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"show" | "leave" | "gone">(isEntry && !splashBootstrapped ? "show" : "gone");
  const [active, setActive] = useState(isEntry && !splashBootstrapped);

  useLayoutEffect(() => {
    if (!isEntry) {
      if (pathname === HOME_PATH || pathname.startsWith(`${HOME_PATH}/`)) {
        splashBootstrapped = true;
      }
      setActive(false);
      setPhase("gone");
      return;
    }

    if (splashBootstrapped) {
      setActive(false);
      setPhase("gone");
      router.replace(HOME_PATH);
      return;
    }

    setActive(true);
    setPhase("show");
  }, [isEntry, pathname, router]);

  useEffect(() => {
    if (!active || !isEntry) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 700 : LOAD_MS;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const next = Math.min(1, (now - started) / duration);
      if (barRef.current) barRef.current.style.width = `${next * 100}%`;
      if (next < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    const leaveTimer = window.setTimeout(() => {
      splashBootstrapped = true;
      setPhase("leave");
      document.body.style.overflow = previousOverflow;
      router.replace(HOME_PATH);
    }, duration);
    const goneTimer = window.setTimeout(() => setPhase("gone"), duration + FADE_MS);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(leaveTimer);
      window.clearTimeout(goneTimer);
    };
  }, [active, isEntry, router]);

  if (!isEntry || phase === "gone" || !active) return null;

  return (
    <div
      className={`fixed inset-0 z-[80] overflow-hidden bg-[#07041c] text-white transition-opacity duration-500 ${
        phase === "leave" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      role="status"
      aria-live="polite"
      aria-busy={phase === "show"}
      aria-label="Loading Vezora"
    >
      <SplashBackdrop />
      <GlassIcon className="left-[7%] top-[18%] hidden sm:flex">
        <Type className="size-5" />
      </GlassIcon>
      <GlassIcon className="left-[12%] top-[40%] hidden md:flex">
        <ImageIcon className="size-5" />
      </GlassIcon>
      <GlassIcon className="left-[8%] top-[64%] hidden lg:flex">
        <Droplet className="size-5" />
      </GlassIcon>
      <GlassIcon className="right-[8%] top-[16%] hidden md:flex">
        <PenTool className="size-5" />
      </GlassIcon>
      <GlassIcon className="right-[11%] top-[42%] hidden sm:flex">
        <ColorDots />
      </GlassIcon>
      <GlassIcon className="right-[7%] top-[66%] hidden lg:flex">
        <Layers className="size-5" />
      </GlassIcon>

      <div className="relative flex h-full w-full items-center justify-center px-6 py-10">
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <VezoraMark className="h-24 w-36 sm:h-28 sm:w-40" />
          <h1 className="mt-4 text-5xl font-semibold tracking-tight text-white sm:text-6xl">Vezora</h1>
          <p className="mt-3 text-lg font-medium sm:text-xl">
            <span className="text-[#5eb0ff]">Create.</span>{" "}
            <span className="text-[#c084fc]">Design.</span>{" "}
            <span className="text-[#fb923c]">Inspire.</span>
          </p>
          <p className="mt-2 text-sm text-white/75 sm:text-base">Your Ultimate Logo Creation Tool</p>
          <div className="mt-8 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/15">
            <div
              ref={barRef}
              className="h-full w-0 rounded-full bg-gradient-to-r from-[#7c5cff] via-[#e879f9] to-[#fb923c]"
            />
          </div>
          <p className="mt-3 text-xs tracking-wide text-white/70">Loading Amazing Features...</p>
        </div>
      </div>
    </div>
  );
}

function SplashBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute -top-32 -left-24 h-80 w-[36rem] rounded-full bg-[#2563eb]/55 blur-3xl" />
      <div className="absolute -top-10 right-0 h-56 w-72 rounded-full bg-[#ec4899]/35 blur-3xl" />
      <div className="absolute -bottom-36 left-0 h-80 w-[40rem] rounded-full bg-[#1d4ed8]/60 blur-3xl" />
      <div className="absolute right-0 -bottom-24 h-64 w-80 rounded-full bg-[#7c3aed]/40 blur-3xl" />
    </div>
  );
}

function GlassIcon({ children, className }: { children: ReactNode; className: string }) {
  return (
    <div
      className={`absolute z-10 h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-md ${className}`}
    >
      {children}
    </div>
  );
}

function ColorDots() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <circle cx="8" cy="10" r="4" fill="#60a5fa" />
      <circle cx="15" cy="9" r="4" fill="#c084fc" />
      <circle cx="12" cy="15" r="4" fill="#fb923c" />
    </svg>
  );
}
