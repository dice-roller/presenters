/** The built-in visual modifier families. Once/limited variants share their family icon. */
export type ModifierIcon =
  | "explode"
  | "explode-matching-batch"
  | "explode-matching-batch-failure"
  | "compound"
  | "penetrate"
  | "re-roll"
  | "unique"
  | "min"
  | "max"
  | "target-success"
  | "target-failure"
  | "critical-success"
  | "critical-failure";
export type ModifierIconPosition = "corner" | "below";

const burst =
  "M16 1 19.37 7.87 26.61 5.39 24.13 12.63 31 16 24.13 19.37 26.61 26.61 19.37 24.13 16 31 12.63 24.13 5.39 26.61 7.87 19.37 1 16 7.87 12.63 5.39 5.39 12.63 7.87Z";
const matchingBurst = `<path d="${burst}"/><circle cx="10" cy="16" r="1.8" fill="currentColor" stroke="none"/><circle cx="22" cy="16" r="1.8" fill="currentColor" stroke="none"/>`;
const definitions: Record<
  ModifierIcon,
  { title: string; colour: string; body: string }
> = {
  explode: {
    title: "Explosion triggered",
    colour: "#9b5d0a",
    body: `<path d="${burst}"/>`,
  },
  "explode-matching-batch": {
    title: "Matching batch triggered an extra batch",
    colour: "#9b5d0a",
    body: matchingBurst,
  },
  "explode-matching-batch-failure": {
    title: "Matching batch failed. Pool score reset to 0.",
    colour: "#b34654",
    body: `${matchingBurst}<path d="M11 23 21 9"/>`,
  },
  compound: { title: "Compounding explosion", colour: "#7546b2", body: "" },
  penetrate: {
    title: "Penetrating explosion",
    colour: "#176e8e",
    body: '<path d="M16 2h5v7l-3 4-2-3ZM16 22l3-3 2 3v8h-5Z" fill="currentColor" fill-opacity=".12"/><path d="M2 16h27m-6-5 7 5-7 5m0-12 2-2m-1 17 2 2"/>',
  },
  "re-roll": {
    title: "Re-rolled",
    colour: "#19735d",
    body: '<path d="M27 11A12 12 0 1 0 27 23M27 3v8h-8"/>',
  },
  unique: {
    title: "Re-rolled for uniqueness",
    colour: "#a04476",
    body: '<circle cx="5" cy="16" r="3"/><path d="m16 7 7 9-7 9-7-9Z"/><circle cx="27" cy="16" r="3"/>',
  },
  min: {
    title: "Raised to the minimum",
    colour: "#316eac",
    body: '<path d="M6 27h20M16 23V5m-6 6 6-6 6 6"/>',
  },
  max: {
    title: "Capped at the maximum",
    colour: "#997012",
    body: '<path d="M6 5h20M16 9v18m-6-6 6 6 6-6"/>',
  },
  "target-success": {
    title: "Target success",
    colour: "#247d4a",
    body: '<path d="m5 17 7 7L27 8"/>',
  },
  "target-failure": {
    title: "Target failure",
    colour: "#b34654",
    body: '<path d="m7 7 18 18M25 7 7 25"/>',
  },
  "critical-success": {
    title: "Critical success",
    colour: "#96700b",
    body: '<path d="M16 2 20 11 30 12 22.5 19.5 25.5 29 16 24 6.5 29 9.5 19.5 2 12 12 11Z"/>',
  },
  "critical-failure": {
    title: "Critical failure",
    colour: "#a5406b",
    body: '<path d="M9 28v-6C5 20 3 17 3 12a13 10 0 0 1 26 0c0 5-2 8-6 10v6ZM13 24v4m6-4v4"/><circle cx="10" cy="13" r="2.2" fill="currentColor" stroke="none"/><circle cx="22" cy="13" r="2.2" fill="currentColor" stroke="none"/><path d="m16 17-2 4h4Z" fill="currentColor" stroke="none"/>',
  },
};

export function modifierIcons(flags: readonly string[]): ModifierIcon[] {
  const icons: ModifierIcon[] = [];
  const add = (name: ModifierIcon) => {
    if (!icons.includes(name)) icons.push(name);
  };
  for (const flag of flags) {
    if (flag === "explode" && flags.includes("compound")) continue;
    if (flag === "re-roll-once") add("re-roll");
    else if (flag === "unique-once") add("unique");
    else if (Object.hasOwn(definitions, flag)) add(flag as ModifierIcon);
  }
  return icons;
}

export const modifierIconStyles =
  Object.entries(definitions)
    .map(
      ([name, icon]) =>
        `.result-preview .modifier-${name}{color:var(--modifier-${name}-color,var(--modifier-icon-color,${icon.colour}))}`,
    )
    .join("") +
  ".result-preview .modifier-compound-back{stroke:var(--modifier-explode-color,var(--modifier-icon-color,#9b5d0a))}";

export interface PlacedModifierIcon {
  readonly kind: ModifierIcon;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
export interface ModifierIconLayout {
  readonly items: readonly PlacedModifierIcon[];
  readonly top: number;
  readonly bottom: number;
  readonly padding: number;
}

/** Coordinates are relative to the artwork's origin. Extra rows grow away from the dice. */
export function layoutModifierIcons(
  kinds: readonly ModifierIcon[],
  width: number,
  height: number,
  iconSize: number,
  position: ModifierIconPosition,
): ModifierIconLayout {
  if (!kinds.length) return { items: [], top: 0, bottom: 0, padding: 6 };
  const gap = Math.max(4, iconSize * 0.2);
  const rows: { kind: ModifierIcon; width: number }[][] = [[]];
  let used = 0;
  for (const kind of kinds) {
    const iconWidth = iconSize * (kind === "compound" ? 1.3 : 1);
    if (used && used + gap + iconWidth > width) {
      rows.push([]);
      used = 0;
    }
    rows[rows.length - 1]!.push({ kind, width: iconWidth });
    used += (used ? gap : 0) + iconWidth;
  }
  const items: PlacedModifierIcon[] = [];
  for (const [index, row] of rows.entries()) {
    const rowWidth =
      row.reduce((sum, item) => sum + item.width, 0) + (row.length - 1) * gap;
    let x =
      position === "corner"
        ? width + row.at(-1)!.width / 2 - rowWidth
        : (width - rowWidth) / 2;
    const y =
      position === "corner"
        ? -iconSize / 2 - index * (iconSize + gap)
        : height + 6 + index * (iconSize + gap);
    for (const item of row) {
      items.push({ ...item, x, y, height: iconSize });
      x += item.width + gap;
    }
  }
  return {
    items,
    top:
      position === "corner"
        ? iconSize / 2 + (rows.length - 1) * (iconSize + gap) + 3
        : 0,
    bottom:
      position === "below"
        ? 10 + rows.length * iconSize + (rows.length - 1) * gap
        : 0,
    padding: position === "corner" ? Math.max(6, iconSize * 0.65 + 5) : 6,
  };
}

/** A luminance cutout removes artwork, rather than painting a background-coloured cover. */
export function renderModifierCutout(
  id: string,
  items: readonly PlacedModifierIcon[],
  width: number,
  height: number,
  scale = 1,
): string {
  return `<defs><mask id="${id}" class="modifier-cutout" stroke="none" maskUnits="userSpaceOnUse" x="0" y="0" width="${width * scale}" height="${height * scale}"><rect width="${width * scale}" height="${height * scale}" fill="white"/>${items.map((icon) => `<circle cx="${(icon.x + icon.width / 2) * scale}" cy="${(icon.y + icon.height / 2) * scale}" r="${(Math.max(icon.width, icon.height) / 2 + 5) * scale}" fill="black"/>`).join("")}</mask></defs>`;
}

export function renderModifierIcon(
  icon: PlacedModifierIcon,
  id: string,
  x = 0,
  y = 0,
): string {
  const { kind, width, height } = icon;
  const definition = definitions[kind];
  let body = definition.body;
  if (kind === "compound") {
    body = `<defs><mask id="${id}" class="modifier-overlap-mask" maskUnits="userSpaceOnUse" x="-2" y="-5" width="48" height="40"><rect x="-2" y="-5" width="48" height="40" fill="white" stroke="none"/><path d="${burst}" fill="black" stroke="black" stroke-width="1.8"/></mask></defs><g mask="url(#${id})"><path class="modifier-compound-back" stroke="#9b5d0a" transform="translate(10 -2)" d="${burst}"/></g><path d="${burst}"/>`;
  }
  const box = kind === "compound" ? "0 -3 43 35" : "0 0 32 32";
  return `<svg class="modifier-icon modifier-${kind}" data-modifier="${kind}" color="${definition.colour}" x="${x + icon.x}" y="${y + icon.y}" width="${width}" height="${height}" viewBox="${box}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${definition.title}"><title>${definition.title}</title><rect x="0" y="${kind === "compound" ? -3 : 0}" width="${kind === "compound" ? 43 : 32}" height="${kind === "compound" ? 35 : 32}" fill="transparent" stroke="none"/>${body}</svg>`;
}
