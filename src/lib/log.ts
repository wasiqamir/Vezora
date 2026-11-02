type Level = "info" | "error";

export function logEvent(level: Level, event: string, fields: Record<string, string | number | boolean | null> = {}) {
  const line = {
    time: new Date().toISOString(),
    level,
    event,
    ...fields,
  };
  const write = level === "error" ? console.error : console.info;
  write(JSON.stringify(line));
}
