import { useId } from "react";

export function VezoraMark({ className }: { className?: string }) {
  const raw = useId().replaceAll(":", "");
  const left = `${raw}-left`;
  const right = `${raw}-right`;

  return (
    <svg viewBox="0 0 220 150" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={left} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#d946ef" />
        </linearGradient>
        <linearGradient id={right} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="40%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#fb923c" />
        </linearGradient>
      </defs>
      <path
        d="M34 36 C78 30 92 72 108 118"
        fill="none"
        stroke={`url(#${left})`}
        strokeWidth="36"
        strokeLinecap="round"
      />
      <path
        d="M108 118 C124 72 146 40 190 34"
        fill="none"
        stroke={`url(#${right})`}
        strokeWidth="36"
        strokeLinecap="round"
      />
      <path d="M168 18 l6 12 l6 -12 l-6 -4 z" fill="#f9a8d4" />
      <path d="M184 8 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3 z" fill="#fbcfe8" />
    </svg>
  );
}
