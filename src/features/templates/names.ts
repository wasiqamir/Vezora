const NAME_LIMIT = 80;

function clean(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > NAME_LIMIT) return null;
  return name;
}

export function templateProjectName(templateName: string, existingNames: Iterable<string>) {
  const name = clean(templateName) ?? "Untitled logo";
  const taken = new Set(existingNames);
  if (!taken.has(name)) return name;
  return clean(`${name} copy`) ?? "Untitled logo copy";
}
