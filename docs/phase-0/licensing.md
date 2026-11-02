# Licensing

**Status:** Locked for Phase 1.

Ship only assets and libraries the product is allowed to use inside a commercial web app and inside files a user downloads. Phase 6 still checks each font file's license text before that font is enabled. The rules below do not wait for that check.

## Fonts

v1 uses SIL Open Font License fonts only. Users may not upload fonts.

The editor loads the SIL Open Font License faces in `src/features/editor/font-setup.ts`, and no others, until that list is edited. The files are stored in `public/fonts` and served by the app. Every face below is SIL OFL. Adobe, Monotype, Apache, Ubuntu Font License, and system fonts stay out.

| Category | Fonts |
|---|---|
| Sans | Inter, Outfit, Geist, Manrope, Plus Jakarta Sans, DM Sans, Figtree, Instrument Sans, Schibsted Grotesk, Familjen Grotesk, Host Grotesk, Hanken Grotesk, Bricolage Grotesque, Onest, Albert Sans, Urbanist, Sora, Syne, Space Grotesk, Montserrat, Poppins, Source Sans 3, Archivo, Barlow, Work Sans, IBM Plex Sans, Raleway, Libre Franklin, Public Sans, Mulish, Karla, Rubik, Nunito Sans, Josefin Sans, Red Hat Display, Red Hat Text, Overpass, Epilogue, Commissioner, Be Vietnam Pro, Noto Sans |
| Rounded | Nunito, Quicksand, Comfortaa, Varela Round, Fredoka, Baloo 2, Comic Neue, Sniglet |
| Serif | Playfair Display, Fraunces, Libre Baskerville, Cormorant Garamond, EB Garamond, Crimson Pro, Lora, Merriweather, Newsreader, Source Serif 4, Instrument Serif, Bodoni Moda, Cinzel, Literata, Alegreya, Spectral, Old Standard TT, Libre Caslon Text, Young Serif, Marcellus, Italiana, Yeseva One, PT Serif, Noto Serif, Noto Serif Display, Domine, Vollkorn |
| Slab | Zilla Slab, Bitter, Arvo, Josefin Slab, Crete Round, Alfa Slab One |
| Display | Bebas Neue, Oswald, Anton, Barlow Condensed, Archivo Black, League Spartan, Teko, Staatliches, Abril Fatface, Unbounded, Big Shoulders, Poiret One, Tenor Sans, Syncopate, Passion One, Ultra, Fjalla One, Pathway Gothic One, Six Caps, Yanone Kaffeesatz, Climate Crisis |
| Script | Great Vibes, Allura, Sacramento, Parisienne, Pinyon Script, Alex Brush, Italianno, Birthstone, Tangerine, Mrs Saint Delafield, Rouge Script, La Belle Aurore, Dancing Script, Caveat, Pacifico, Lobster, Satisfy, Cookie, Kaushan Script, Yellowtail, Permanent Marker, Indie Flower, Amatic SC, Patrick Hand, Shadows Into Light, Homemade Apple, Rock Salt, Grape Nuts |
| Mono | Space Mono, IBM Plex Mono, JetBrains Mono, Inconsolata, DM Mono, Courier Prime, Share Tech Mono, Special Elite, Red Hat Mono, Geist Mono, Fira Mono, PT Mono |
| Pixel | Press Start 2P, Silkscreen, VT323, Pixelify Sans, DotGothic16, Micro 5, Sixtyfour |
| Blackletter | UnifrakturMaguntia, Uncial Antiqua, Pirata One, MedievalSharp, IM Fell English, New Rocker |
| Tech | Orbitron, Audiowide, Rajdhani, Chakra Petch, Exo 2, Tektur, Bungee, Black Ops One, Monoton, Handjet |

Default font for new text: Outfit.

Exported SVG keeps the font family name. The export screen should tell the user that the SVG looks the same on another computer only if that font is installed. PNG export is flattened, so it does not need the font later.

Do not add Adobe, Monotype, or system fonts (including Segoe UI and Arial) to the product font list. The sample PNGs in `test-logos/` may use Segoe UI because they are fixtures rendered on Windows, not product fonts.

## Icons and templates

- Logo icons and the eight starter templates are original artwork created for this project.
- Do not use Lucide, Heroicons, or other UI icon sets as logo artwork. Many users would export the same mark, and those sets are for interface chrome.
- Interface icons in the app chrome may use Lucide (ISC).

Each system asset record stores `licenseName` and `sourceName`. For original work those values are `Original` and `Logo Creation Tool`.

## User uploads

The user is responsible for the right to upload a PNG, JPG, or SVG. The app does not claim ownership of the upload or of the project JSON. Reconstruction writes a new editable draft. It is not a promise that the draft is free of someone else's trademark or copyright.

## Libraries for the app

Use these licenses as the baseline. Confirm the exact package license at install time and reject a dependency that is GPL or AGPL if it would be linked into the server or the client.

| Piece | License to require | Role |
|---|---|---|
| Next.js, React, Fabric.js, Tailwind CSS, Zod, Zustand | MIT | App and canvas |
| Prisma | Apache-2.0 | Database access |
| Auth.js | ISC | Sign-in |
| shadcn/ui components | MIT | Interface |
| Lucide | ISC | Interface icons only |
| VTracer | MIT | Raster to vector paths |
| Tesseract.js | Apache-2.0 | OCR suggestions |
| OpenCV (server worker) | Apache-2.0 | Preprocess, colors, contours |

## Potrace

Potrace is GPL-2.0. Do not link it into the Next.js server or the browser bundle.

It may be used later as a separate optional process for high-contrast monochrome images, and only after a license review. v1 vectorization goes through VTracer. The test set still includes a monochrome sample so that path can be compared.

## Secrets and third-party accounts

API keys, database URLs, and storage secrets stay in environment variables. They are not committed. Fonts and icons are not loaded from a service that claims extra rights over exported logos.
