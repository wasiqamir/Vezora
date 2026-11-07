const FALLBACK = "/homepage";

/** Only allow same-origin relative paths as post-auth destinations. */
export function safeCallbackUrl(value: unknown, fallback = FALLBACK) {
  if (typeof value !== "string") return fallback;
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return fallback;
  if (path.includes("://")) return fallback;
  return path;
}
