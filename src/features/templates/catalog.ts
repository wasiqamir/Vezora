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
] as const;
