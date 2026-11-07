export const templateCategories = [
  "Startup",
  "Freelancer",
  "Local business",
  "Agency",
] as const;

export type TemplateCategoryLabel = (typeof templateCategories)[number];

export const starterTemplates = [
  {
    slug: "signal",
    name: "Signal",
    category: "Startup",
    description: "Circle mark plus a short wordmark.",
  },
  {
    slug: "northstar",
    name: "Northstar",
    category: "Startup",
    description: "Horizontal name with a small star mark.",
  },
  {
    slug: "studio-mark",
    name: "Studio Mark",
    category: "Freelancer",
    description: "Monogram and a personal name.",
  },
  {
    slug: "monogram",
    name: "Monogram",
    category: "Freelancer",
    description: "Large initials and a small role line.",
  },
  {
    slug: "storefront",
    name: "Storefront",
    category: "Local business",
    description: "Stacked name and town line.",
  },
  {
    slug: "badge",
    name: "Badge",
    category: "Local business",
    description: "Circular badge with a business name.",
  },
  {
    slug: "wordmark-grid",
    name: "Wordmark Grid",
    category: "Agency",
    description: "Wide wordmark, no icon.",
  },
  {
    slug: "split-mark",
    name: "Split Mark",
    category: "Agency",
    description: "Icon on the left, name and service on the right.",
  },
  {
    slug: "pulse",
    name: "Pulse",
    category: "Startup",
    description: "Signal bars mark with a bold electric wordmark.",
  },
  {
    slug: "orbit-lab",
    name: "Orbit Lab",
    category: "Startup",
    description: "Orbit icon beside a sharp modern name lockup.",
  },
  {
    slug: "volt",
    name: "Volt",
    category: "Startup",
    description: "Spark mark with a high-energy stacked wordmark.",
  },
  {
    slug: "bloom-atelier",
    name: "Bloom Atelier",
    category: "Freelancer",
    description: "Bloom icon with a refined personal studio name.",
  },
  {
    slug: "forge",
    name: "Forge",
    category: "Freelancer",
    description: "Diamond mark with a strong monogram lockup.",
  },
  {
    slug: "grove",
    name: "Grove",
    category: "Local business",
    description: "Leaf mark with a warm local shop wordmark.",
  },
  {
    slug: "ember-badge",
    name: "Ember Badge",
    category: "Local business",
    description: "North mark inside a bold circular shop badge.",
  },
  {
    slug: "nova-frame",
    name: "Nova Frame",
    category: "Agency",
    description: "Frame icon with a wide agency wordmark and accent bar.",
  },
  {
    slug: "vector-grid",
    name: "Vector Grid",
    category: "Agency",
    description: "Geometric blocks and a clean agency wordmark.",
  },
] as const;
