const DATABASE_URL_NAMES = [
  "Vezora_DATABASE_URL_UNPOOLED",
  "Vezora_POSTGRES_URL_NON_POOLING",
  "Vezora_POSTGRES_URL",
  "Vezora_DATABASE_URL",
  "DATABASE_URL",
  "Vezora_POSTGRES_URL_NO_SSL",
] as const;

export function normalizeDatabaseUrl(value: string | undefined) {
  if (!value) return "";
  let url = value.trim();
  if (
    (url.startsWith('"') && url.endsWith('"')) ||
    (url.startsWith("'") && url.endsWith("'"))
  ) {
    url = url.slice(1, -1).trim();
  }
  return url;
}

export function databaseUrlCandidates() {
  const seen = new Set<string>();
  const found: { name: string; url: string }[] = [];
  for (const name of DATABASE_URL_NAMES) {
    const url = normalizeDatabaseUrl(process.env[name]);
    if (!url.startsWith("postgres") || seen.has(url)) continue;
    seen.add(url);
    found.push({ name, url });
  }
  return found;
}

export function databaseUrlReport() {
  return DATABASE_URL_NAMES.map((name) => {
    const raw = process.env[name];
    const url = normalizeDatabaseUrl(raw);
    if (raw == null) return { name, state: "missing" };
    if (!url) return { name, state: "empty" };
    if (url.startsWith("postgres")) return { name, state: "postgres" };
    try {
      return { name, state: new URL(url).protocol.replace(":", "") };
    } catch {
      return { name, state: "unparsed" };
    }
  });
}
