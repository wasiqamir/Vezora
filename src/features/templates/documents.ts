import {
  CURRENT_SCHEMA_VERSION,
  type ProjectDocument,
  type ProjectObject,
} from "@/features/projects/document";
import type { TemplateCategoryLabel } from "@/features/templates/catalog";

export type StarterTemplate = {
  slug: string;
  name: string;
  category: TemplateCategoryLabel;
  description: string;
  document: ProjectDocument;
};

type ObjectInput = Pick<ProjectObject, "id" | "type" | "name" | "x" | "y" | "width" | "height"> &
  Partial<ProjectObject>;

function item(input: ObjectInput): ProjectObject {
  return {
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    opacity: 1,
    visible: true,
    locked: false,
    ...input,
  };
}

function text(input: {
  id: string;
  name: string;
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fill: string;
  fontId?: string;
  fontFamily?: string;
  fontWeight?: number;
  letterSpacing?: number;
}): ProjectObject {
  return item({
    id: input.id,
    type: "text",
    name: input.name,
    text: input.text,
    x: input.x,
    y: input.y,
    width: input.width,
    height: Math.round(input.fontSize * 1.2),
    fill: input.fill,
    fontId: input.fontId ?? "outfit",
    fontFamily: input.fontFamily ?? "Outfit",
    fontSize: input.fontSize,
    fontWeight: input.fontWeight ?? 500,
    letterSpacing: input.letterSpacing ?? 0,
    lineHeight: 1.16,
    textAlign: "left",
  });
}

function document(
  preset: ProjectDocument["artboard"]["preset"],
  width: number,
  height: number,
  background: string,
  objects: ProjectObject[],
): ProjectDocument {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    artboard: { preset, width, height, background },
    objects,
  };
}

export const starterTemplateDocuments: StarterTemplate[] = [
  {
    slug: "signal",
    name: "Signal",
    category: "Startup",
    description: "Circle mark plus a short wordmark.",
    document: document("square", 1000, 1000, "#ffffff", [
      item({
        id: "signal_mark",
        type: "ellipse",
        name: "Mark",
        x: 390,
        y: 210,
        width: 220,
        height: 220,
        rx: 110,
        ry: 110,
        fill: "#123C34",
      }),
      text({
        id: "signal_name",
        name: "Name",
        text: "SIGNAL",
        x: 356,
        y: 500,
        width: 288,
        fontSize: 78,
        fontWeight: 600,
        fill: "#123C34",
      }),
      text({
        id: "signal_line",
        name: "Line",
        text: "STARTUP",
        x: 392,
        y: 600,
        width: 216,
        fontSize: 18,
        letterSpacing: 480,
        fill: "#5E6A64",
      }),
    ]),
  },
  {
    slug: "northstar",
    name: "Northstar",
    category: "Startup",
    description: "Horizontal name with a small star mark.",
    document: document("horizontal", 1600, 800, "#F7F4EF", [
      item({
        id: "northstar_mark",
        type: "icon",
        name: "Star",
        iconId: "spark",
        x: 180,
        y: 300,
        width: 180,
        height: 180,
        fill: "#1C3D5A",
      }),
      text({
        id: "northstar_name",
        name: "Name",
        text: "NORTHSTAR",
        x: 430,
        y: 320,
        width: 620,
        fontSize: 84,
        fontWeight: 600,
        fill: "#1C3D5A",
      }),
      text({
        id: "northstar_line",
        name: "Line",
        text: "GUIDED GROWTH",
        x: 438,
        y: 440,
        width: 420,
        fontSize: 20,
        letterSpacing: 280,
        fill: "#8A7348",
      }),
    ]),
  },
  {
    slug: "studio-mark",
    name: "Studio Mark",
    category: "Freelancer",
    description: "Monogram and a personal name.",
    document: document("square", 1000, 1000, "#F4F1EA", [
      text({
        id: "studio_mark",
        name: "Monogram",
        text: "SM",
        x: 250,
        y: 220,
        width: 500,
        fontSize: 220,
        fontId: "playfair-display",
        fontFamily: "Playfair Display",
        fontWeight: 500,
        fill: "#2C2420",
      }),
      item({
        id: "studio_rule",
        type: "rect",
        name: "Rule",
        x: 420,
        y: 560,
        width: 160,
        height: 3,
        fill: "#C4A574",
      }),
      text({
        id: "studio_name",
        name: "Name",
        text: "STUDIO NORTH",
        x: 310,
        y: 590,
        width: 380,
        fontSize: 22,
        letterSpacing: 360,
        fill: "#2C2420",
      }),
    ]),
  },
  {
    slug: "monogram",
    name: "Monogram",
    category: "Freelancer",
    description: "Large initials and a small role line.",
    document: document("square", 1000, 1000, "#161616", [
      text({
        id: "monogram_initials",
        name: "Initials",
        text: "JL",
        x: 270,
        y: 250,
        width: 460,
        fontSize: 240,
        fontId: "cormorant-garamond",
        fontFamily: "Cormorant Garamond",
        fontWeight: 500,
        fill: "#F3EDE4",
      }),
      text({
        id: "monogram_role",
        name: "Role",
        text: "BRAND DESIGN",
        x: 330,
        y: 640,
        width: 340,
        fontSize: 16,
        letterSpacing: 420,
        fill: "#C5A46D",
      }),
    ]),
  },
  {
    slug: "storefront",
    name: "Storefront",
    category: "Local business",
    description: "Stacked name and town line.",
    document: document("square", 1000, 1000, "#F6F1E7", [
      text({
        id: "store_name",
        name: "Name",
        text: "HARBOR",
        x: 250,
        y: 280,
        width: 500,
        fontSize: 92,
        fontWeight: 600,
        fill: "#1E3A34",
      }),
      text({
        id: "store_trade",
        name: "Trade",
        text: "BAKERY",
        x: 330,
        y: 400,
        width: 340,
        fontSize: 56,
        fontWeight: 500,
        fill: "#1E3A34",
      }),
      item({
        id: "store_rule",
        type: "rect",
        name: "Rule",
        x: 360,
        y: 500,
        width: 280,
        height: 2,
        fill: "#C47B4A",
      }),
      text({
        id: "store_town",
        name: "Town",
        text: "MILLTOWN",
        x: 370,
        y: 530,
        width: 260,
        fontSize: 20,
        letterSpacing: 500,
        fill: "#6B4A32",
      }),
    ]),
  },
  {
    slug: "badge",
    name: "Badge",
    category: "Local business",
    description: "Circular badge with a business name.",
    document: document("square", 1000, 1000, "#FBF7F0", [
      item({
        id: "badge_ring",
        type: "ellipse",
        name: "Ring",
        x: 280,
        y: 180,
        width: 440,
        height: 440,
        rx: 220,
        ry: 220,
        fill: null,
        stroke: "#1F2A44",
        strokeWidth: 10,
      }),
      text({
        id: "badge_name",
        name: "Name",
        text: "OAK & RYE",
        x: 330,
        y: 400,
        width: 340,
        fontSize: 48,
        fontId: "playfair-display",
        fontFamily: "Playfair Display",
        fontWeight: 500,
        fill: "#1F2A44",
      }),
      text({
        id: "badge_year",
        name: "Year",
        text: "EST. 1984",
        x: 400,
        y: 480,
        width: 200,
        fontSize: 18,
        letterSpacing: 200,
        fill: "#8C6A3D",
      }),
    ]),
  },
  {
    slug: "wordmark-grid",
    name: "Wordmark Grid",
    category: "Agency",
    description: "Wide wordmark, no icon.",
    document: document("horizontal", 1600, 800, "#ffffff", [
      text({
        id: "grid_north",
        name: "North",
        text: "NORTH",
        x: 180,
        y: 220,
        width: 700,
        fontSize: 120,
        fontWeight: 600,
        fill: "#141414",
      }),
      text({
        id: "grid_form",
        name: "Form",
        text: "FORM",
        x: 184,
        y: 370,
        width: 520,
        fontSize: 120,
        fontWeight: 400,
        fill: "#141414",
      }),
      text({
        id: "grid_studio",
        name: "Studio",
        text: "STUDIO",
        x: 190,
        y: 530,
        width: 280,
        fontSize: 22,
        letterSpacing: 600,
        fill: "#141414",
      }),
    ]),
  },
  {
    slug: "split-mark",
    name: "Split Mark",
    category: "Agency",
    description: "Icon on the left, name and service on the right.",
    document: document("horizontal", 1600, 800, "#F3F6F4", [
      item({
        id: "split_mark",
        type: "icon",
        name: "Mark",
        iconId: "frame",
        x: 150,
        y: 280,
        width: 200,
        height: 200,
        fill: "#17342C",
      }),
      text({
        id: "split_name",
        name: "Name",
        text: "HALDEN",
        x: 440,
        y: 290,
        width: 520,
        fontSize: 88,
        fontWeight: 600,
        fill: "#17342C",
      }),
      text({
        id: "split_service",
        name: "Service",
        text: "IDENTITY STUDIO",
        x: 448,
        y: 410,
        width: 460,
        fontSize: 22,
        letterSpacing: 360,
        fill: "#17342C",
      }),
    ]),
  },
];
