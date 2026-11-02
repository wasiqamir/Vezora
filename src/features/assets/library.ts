import { LOGO_ICONS } from "@/features/editor/icons";
import { getEditorFontSetup } from "@/features/editor/font-setup";

export const ORIGINAL_LICENSE = {
  licenseName: "Original",
  sourceName: "Logo Creation Tool",
} as const;

export const FONT_LICENSE = {
  licenseName: "SIL Open Font License 1.1",
  sourceName: "SIL Open Font License",
} as const;

export function iconLibrary() {
  return LOGO_ICONS.map((icon) => ({
    id: icon.id,
    name: icon.name,
    kind: "icon" as const,
    ...ORIGINAL_LICENSE,
  }));
}

export function fontLibrary() {
  return getEditorFontSetup().options.map((font) => ({
    id: font.id,
    name: font.label,
    category: font.category,
    kind: "font" as const,
    ...FONT_LICENSE,
  }));
}
