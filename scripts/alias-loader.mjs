import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    let file = path.resolve(process.cwd(), "src", specifier.slice(2));
    if (!path.extname(file)) {
      if (existsSync(`${file}.ts`)) file = `${file}.ts`;
      else if (existsSync(`${file}.tsx`)) file = `${file}.tsx`;
      else if (existsSync(path.join(file, "index.ts"))) file = path.join(file, "index.ts");
    }
    return nextResolve(pathToFileURL(file).href, context);
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const parent = fileURLToPath(context.parentURL);
    if (parent.endsWith(".ts") && !path.extname(specifier)) {
      const file = path.resolve(path.dirname(parent), specifier);
      if (existsSync(`${file}.ts`)) return nextResolve(pathToFileURL(`${file}.ts`).href, context);
    }
  }
  return nextResolve(specifier, context);
}
