export type LogoIconPath = {
  d: string;
  rule?: "evenodd";
};

export type LogoIcon = {
  id: string;
  name: string;
  paths: LogoIconPath[];
};

export const LOGO_ICONS: LogoIcon[] = [
  {
    id: "north",
    name: "North",
    paths: [{ d: "M50 10 L90 86 H64 L50 58 L36 86 H10 Z" }],
  },
  {
    id: "orbit",
    name: "Orbit",
    paths: [
      {
        d: "M50 8 A42 42 0 1 0 50.01 8 Z M50 28 A22 22 0 1 1 49.99 28 Z",
        rule: "evenodd",
      },
    ],
  },
  {
    id: "diamond",
    name: "Diamond",
    paths: [{ d: "M50 6 L94 50 L50 94 L6 50 Z" }],
  },
  {
    id: "signal",
    name: "Signal",
    paths: [
      { d: "M14 58 H32 V86 H14 Z" },
      { d: "M41 36 H59 V86 H41 Z" },
      { d: "M68 16 H86 V86 H68 Z" },
    ],
  },
  {
    id: "bloom",
    name: "Bloom",
    paths: [
      { d: "M50 8 A16 16 0 1 0 50.01 8 Z" },
      { d: "M78 36 A16 16 0 1 0 78.01 36 Z" },
      { d: "M50 64 A16 16 0 1 0 50.01 64 Z" },
      { d: "M22 36 A16 16 0 1 0 22.01 36 Z" },
    ],
  },
  {
    id: "frame",
    name: "Frame",
    paths: [
      {
        d: "M28 12 H72 A16 16 0 0 1 88 28 V72 A16 16 0 0 1 72 88 H28 A16 16 0 0 1 12 72 V28 A16 16 0 0 1 28 12 Z M36 30 H64 A6 6 0 0 1 70 36 V64 A6 6 0 0 1 64 70 H36 A6 6 0 0 1 30 64 V36 A6 6 0 0 1 36 30 Z",
        rule: "evenodd",
      },
    ],
  },
  {
    id: "leaf",
    name: "Leaf",
    paths: [
      {
        d: "M50 90 C20 70 12 40 28 22 C40 10 58 14 62 28 C78 20 90 36 84 54 C78 78 62 88 50 90 Z",
      },
    ],
  },
  {
    id: "spark",
    name: "Spark",
    paths: [{ d: "M50 6 L58 42 L94 50 L58 58 L50 94 L42 58 L6 50 L42 42 Z" }],
  },
];

export function iconSvg(icon: LogoIcon, fill = "#171717") {
  const paths = icon.paths
    .map((path) => {
      const rule = path.rule ? ` fill-rule="${path.rule}"` : "";
      return `<path${rule} fill="${fill}" d="${path.d}"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${paths}</svg>`;
}
