import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fontDir = join(root, "public", "fonts");
const ua =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const data = JSON.parse(
  await readFile(join(root, "node_modules/next/dist/compiled/@next/font/dist/google/font-data.json"), "utf8"),
);

const catalog = [
  ["Sans", ["Inter", "Outfit", "Geist", "Manrope", "Plus Jakarta Sans", "DM Sans", "Figtree", "Instrument Sans", "Schibsted Grotesk", "Familjen Grotesk", "Host Grotesk", "Hanken Grotesk", "Bricolage Grotesque", "Onest", "Albert Sans", "Urbanist", "Sora", "Syne", "Space Grotesk", "Montserrat", "Poppins", "Source Sans 3", "Archivo", "Barlow", "Work Sans", "IBM Plex Sans", "Raleway", "Libre Franklin", "Public Sans", "Mulish", "Karla", "Rubik", "Nunito Sans", "Josefin Sans", "Red Hat Display", "Red Hat Text", "Overpass", "Epilogue", "Commissioner", "Be Vietnam Pro", "Noto Sans"]],
  ["Rounded", ["Nunito", "Quicksand", "Comfortaa", "Varela Round", "Fredoka", "Baloo 2", "Comic Neue", "Sniglet"]],
  ["Serif", ["Playfair Display", "Fraunces", "Libre Baskerville", "Cormorant Garamond", "EB Garamond", "Crimson Pro", "Lora", "Merriweather", "Newsreader", "Source Serif 4", "Instrument Serif", "Bodoni Moda", "Cinzel", "Literata", "Alegreya", "Spectral", "Old Standard TT", "Libre Caslon Text", "Young Serif", "Marcellus", "Italiana", "Yeseva One", "PT Serif", "Noto Serif", "Noto Serif Display", "Domine", "Vollkorn"]],
  ["Slab", ["Zilla Slab", "Bitter", "Arvo", "Josefin Slab", "Crete Round", "Alfa Slab One"]],
  ["Display", ["Bebas Neue", "Oswald", "Anton", "Barlow Condensed", "Archivo Black", "League Spartan", "Teko", "Staatliches", "Abril Fatface", "Unbounded", "Big Shoulders", "Poiret One", "Tenor Sans", "Syncopate", "Passion One", "Ultra", "Fjalla One", "Pathway Gothic One", "Six Caps", "Yanone Kaffeesatz", "Climate Crisis"]],
  ["Script", ["Great Vibes", "Allura", "Sacramento", "Parisienne", "Pinyon Script", "Alex Brush", "Italianno", "Birthstone", "Tangerine", "Mrs Saint Delafield", "Rouge Script", "La Belle Aurore", "Dancing Script", "Caveat", "Pacifico", "Lobster", "Satisfy", "Cookie", "Kaushan Script", "Yellowtail", "Permanent Marker", "Indie Flower", "Amatic SC", "Patrick Hand", "Shadows Into Light", "Homemade Apple", "Rock Salt", "Grape Nuts"]],
  ["Mono", ["Space Mono", "IBM Plex Mono", "JetBrains Mono", "Inconsolata", "DM Mono", "Courier Prime", "Share Tech Mono", "Special Elite", "Red Hat Mono", "Geist Mono", "Fira Mono", "PT Mono"]],
  ["Pixel", ["Press Start 2P", "Silkscreen", "VT323", "Pixelify Sans", "DotGothic16", "Micro 5", "Sixtyfour"]],
  ["Blackletter", ["UnifrakturMaguntia", "Uncial Antiqua", "Pirata One", "MedievalSharp", "IM Fell English", "New Rocker"]],
  ["Tech", ["Orbitron", "Audiowide", "Rajdhani", "Chakra Petch", "Exo 2", "Tektur", "Bungee", "Black Ops One", "Monoton", "Handjet"]],
];

const wanted = ["400", "500", "600", "700"];
const entries = [];
for (const [category, names] of catalog) {
  for (const name of names) {
    const font = data[name];
    if (!font) throw new Error(`Missing font ${name}`);
    const weights = font.weights.filter((weight) => wanted.includes(weight));
    if (weights.length === 0) throw new Error(`No weights for ${name}`);
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    entries.push({
      category,
      name,
      id,
      weights,
      variable: font.weights.includes("variable"),
    });
  }
}

await mkdir(fontDir, { recursive: true });

const cssChunks = [];
const saved = new Map();
let bytes = 0;

for (let index = 0; index < entries.length; index += 10) {
  const batch = entries.slice(index, index + 10);
  const css = await fetchBatch(batch);
  const faces = parseFaces(css);
  for (const entry of batch) {
    const own = faces.filter((face) => face.family === entry.name);
    if (own.length === 0) throw new Error(`No Latin files for ${entry.name}`);
    for (const face of own) {
      const file = await saveFace(entry, face);
      cssChunks.push(`@font-face {
  font-family: "${face.family}";
  font-style: normal;
  font-weight: ${face.weight};
  font-display: swap;
  src: url("/fonts/${file}") format("woff2");
  unicode-range: ${face.range};
}`);
    }
  }
  console.log(`CSS ${Math.min(index + batch.length, entries.length)}/${entries.length}`);
}

await writeFile(join(root, "src/features/editor/logo-fonts.css"), `${cssChunks.join("\n\n")}\n`);

const registry = entries
  .map(
    (entry) =>
      `  { id: "${entry.id}", label: "${entry.name}", category: "${entry.category}" },`,
  )
  .join("\n");

await writeFile(
  join(root, "src/features/editor/font-setup.ts"),
  `import "./logo-fonts.css";
import type { EditorFontOption } from "@/features/editor/types";

const registry = [
${registry}
] as const;

export const DEFAULT_FONT_ID = "outfit";

export function getEditorFontSetup(): { className: string; options: EditorFontOption[] } {
  return {
    className: "",
    options: registry.map((item) => ({
      id: item.id,
      label: item.label,
      category: item.category,
      canvasFamily: item.label,
    })),
  };
}
`,
);

console.log(`Saved ${saved.size} files, ${(bytes / 1024 / 1024).toFixed(1)} MB`);

function specFor(entry, ranged) {
  const query = entry.name.replace(/ /g, "+");
  if (ranged && entry.variable && entry.weights.length > 1) {
    return `${query}:wght@${entry.weights[0]}..${entry.weights.at(-1)}`;
  }
  return `${query}:wght@${entry.weights.join(";")}`;
}

async function fetchBatch(batch) {
  const ranged = await requestCss(batch.map((entry) => specFor(entry, true)));
  if (ranged) return ranged;
  const parts = [];
  for (const entry of batch) {
    const css = await requestCss([specFor(entry, false)]);
    if (!css) throw new Error(`Google Fonts rejected ${entry.name}`);
    parts.push(css);
  }
  return parts.join("\n");
}

async function requestCss(specs) {
  const url = `https://fonts.googleapis.com/css2?family=${specs.join("&family=")}&display=swap`;
  const response = await fetch(url, { headers: { "User-Agent": ua } });
  if (!response.ok) return null;
  return response.text();
}

function parseFaces(css) {
  const faces = [];
  for (const part of css.split(/\/\*\s*/)) {
    const commentEnd = part.indexOf("*/");
    if (commentEnd < 0) continue;
    const subset = part.slice(0, commentEnd).trim();
    if (subset !== "latin" && subset !== "latin-ext") continue;
    const body = part.slice(commentEnd);
    const family = body.match(/font-family:\s*'([^']+)'/)?.[1];
    const weight = body.match(/font-weight:\s*([^;]+)/)?.[1]?.trim();
    const url = body.match(/url\((https:[^)]+)\)/)?.[1];
    const range = body.match(/unicode-range:\s*([^;]+)/)?.[1]?.trim();
    if (!family || !weight || !url || !range) continue;
    faces.push({ subset, family, weight, url, range });
  }
  return faces;
}

async function saveFace(entry, face) {
  const existing = saved.get(face.url);
  if (existing) return existing;
  const weight = face.weight.replace(/\s+/g, "-");
  const file = `${entry.id}-${face.subset}-${weight}.woff2`;
  const response = await fetch(face.url);
  if (!response.ok || !response.body) throw new Error(`Download failed for ${entry.name}`);
  const target = join(fontDir, file);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(target));
  const size = Number(response.headers.get("content-length") ?? 0);
  bytes += size;
  saved.set(face.url, file);
  return file;
}
