import { fillValueSlot } from "./value-slot.js";
import type {
  ExpressionResult,
  HistoryData,
  RollData,
  Presentable,
  Presenter,
  results,
} from "@dice-roller/rpg-dice-roller";

type PoolResult = results.PoolResult;
type ScoredItem = results.ScoredItem;
export type SvgRoll = Pick<RollData, "notation" | "total" | "result">;
export type SvgHistory = Pick<HistoryData, "total"> & {
  readonly rolls: readonly SvgRoll[];
};

export interface Appearance {
  readonly size: number;
  readonly stroke: string;
  readonly fill: string;
  readonly filled: boolean;
  readonly showValues: boolean;
}

type Token =
  | { kind: "text"; value: string; excluded: boolean }
  | {
      kind: "die";
      pool: PoolResult;
      roll: PoolResult["rolls"][number];
      excluded: boolean;
    };
const escape = (value: string | number) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
const flagLabels: Record<string, string> = {
  explode: "!",
  compound: "!!",
  penetrate: "p",
  drop: "drop",
  "re-roll": "r",
  "re-roll-once": "ro",
  unique: "u",
  "unique-once": "uo",
  "critical-success": "CS",
  "critical-failure": "CF",
  "target-success": "success",
  "target-failure": "failure",
  min: "min",
  max: "max",
};

function markers(item: ScoredItem): string {
  const flags = item.flags.map((flag) => flagLabels[flag] ?? flag);
  if (!item.useInTotal && !flags.includes("drop")) flags.push("drop");
  if (item.calculationValue !== item.value)
    flags.push(
      `score ${item.calculationValue > 0 ? "+" : ""}${item.calculationValue}`,
    );
  return flags.join(" · ");
}

function tokens(
  result: ExpressionResult,
  excluded = false,
  minimum = 0,
): Token[] {
  const text = (value: string): Token => ({ kind: "text", value, excluded });
  const join = (
    items: readonly ExpressionResult[],
    separator: string,
  ): Token[] =>
    items.flatMap((item, index) => [
      ...(index ? [text(separator)] : []),
      ...tokens(item, excluded),
    ]);
  switch (result.type) {
    case "number":
      return [text(String(result.value))];
    case "pool":
      return [
        text("("),
        ...result.rolls.flatMap((roll, index): Token[] => [
          ...(index ? [text("+")] : []),
          {
            kind: "die",
            pool: result,
            roll,
            excluded: excluded || !roll.useInTotal,
          },
        ]),
        text(")"),
      ];
    case "paren":
      return [text("("), ...tokens(result.inner, excluded), text(")")];
    case "function":
      return [
        text(`${result.node.name}(`),
        ...join(result.args, ","),
        text(")"),
      ];
    case "unary":
      return [text("−"), ...tokens(result.operand, excluded, 3)];
    case "group":
      return [
        text("{"),
        ...result.members.flatMap((member, index) => {
          const dropped = excluded || !member.useInTotal;
          return [
            ...(index ? [text(",")] : []),
            ...tokens(member.result, dropped),
            ...(markers(member)
              ? [
                  {
                    kind: "text" as const,
                    value: `(${markers(member)})`,
                    excluded: dropped,
                  },
                ]
              : []),
          ];
        }),
        text("}"),
      ];
    case "binary": {
      const op = String(result.node.op);
      const precedence =
        { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2, "^": 4 }[op] ?? 0;
      const body = [
        ...tokens(result.left, excluded, precedence + (op === "^" ? 1 : 0)),
        text({ "*": "×", "/": "÷", "-": "−" }[op] ?? op),
        ...tokens(result.right, excluded, precedence + (op === "^" ? 0 : 1)),
      ];
      return precedence < minimum ? [text("("), ...body, text(")")] : body;
    }
  }
}

/** Returns a standalone SVG from evaluated result data. */
export function renderSvg(
  target: SvgHistory | SvgRoll,
  artwork: Readonly<Record<string, string>>,
  appearance: Appearance,
): string {
  if (
    !Number.isFinite(appearance.size) ||
    appearance.size < 20 ||
    appearance.size > 400
  )
    throw new Error("Invalid dice size");
  for (const colour of [appearance.stroke, appearance.fill]) {
    if (!/^#[0-9a-f]{6}$/i.test(colour))
      throw new Error("Expected a six-digit hex colour");
  }
  const size = appearance.size;
  const width = 1040;
  const padding = 24;
  const font = Math.max(14, Math.min(32, size * 0.2));
  const caption = Math.max(10, Math.min(16, size * 0.12));
  const lineHeight = size + caption * 3 + 28;
  let y = padding;
  const output: string[] = [];
  const label = (
    value: string | number,
    x: number,
    top: number,
    options = "",
  ) => `<text x="${x}" y="${top}" ${options}>${escape(value)}</text>`;

  const isHistory = "rolls" in target;
  const rolls = isHistory ? target.rolls : [target];
  for (const [index, roll] of rolls.entries()) {
    const start = y;
    const heading = isHistory
      ? `${index + 1}. ${roll.notation}`
      : roll.notation;
    // Wrap notation as text as well as wrapping the visual expression.
    const chunks = heading.match(/.{1,100}/g) ?? [heading];
    for (const chunk of chunks) {
      output.push(label(chunk, padding, y + 18, 'class="notation"'));
      y += 24;
    }
    y += 14;
    let x = padding;
    for (const token of tokens(roll.result)) {
      const tokenWidth =
        token.kind === "die"
          ? size + 12
          : Math.max(16, token.value.length * font * 0.62 + 10);
      if (x > padding && x + tokenWidth > width - padding) {
        x = padding;
        y += lineHeight;
      }
      const content: string[] = [];
      if (token.kind === "text") {
        content.push(
          label(
            token.value,
            x + tokenWidth / 2,
            y + size / 2,
            `class="math" text-anchor="middle" dominant-baseline="central" font-size="${font}"`,
          ),
        );
      } else {
        // Centre the artwork within its padded token, just like text tokens.
        const dieX = x + (tokenWidth - size) / 2;
        const { pool, roll: die } = token;
        const fudge = /^F(?:\.[12])?$/.test(pool.die.notation);
        const key = fudge
          ? "d6"
          : pool.die.faceCount === 100
            ? "d10"
            : `d${pool.die.faceCount}`;
        const template = artwork[key] ?? artwork.generic;
        if (!template) throw new Error("Missing generic dice artwork");
        const value = fudge
          ? die.value < 0
            ? "−"
            : die.value > 0
              ? "+"
              : ""
          : die.value;
        const body = template
          .replace(/^<svg\b[^>]*>/, "")
          .replace(/<\/svg>\s*$/, "");
        const details = `d${pool.die.notation}: ${die.value}; contribution ${token.excluded ? 0 : die.calculationValue}${die.flags.length ? `; ${die.flags.join(", ")}` : ""}${die.initialValue !== die.value ? `; initial value ${die.initialValue}` : ""}`;
        content.push(
          `<title>${escape(details)}</title><svg x="${dieX}" y="${y}" width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${fillValueSlot(body, appearance.showValues ? value : "")}</svg>`,
        );
        if (token.excluded)
          content.push(
            `<path d="M${dieX + size * 0.14} ${y + size * 0.5}h${size * 0.72}" stroke="currentColor" stroke-width="2"/>`,
          );
        const dieLabel = `d${pool.die.notation}`;
        content.push(
          label(
            dieLabel.length > 22 ? dieLabel.slice(0, 21) + "…" : dieLabel,
            dieX + size / 2,
            y + size + caption + 4,
            `class="caption" text-anchor="middle" font-size="${caption}"`,
          ),
        );
        const badges = markers(die);
        if (badges)
          content.push(
            label(
              badges,
              dieX + size / 2,
              y + size + caption * 2 + 10,
              `class="badge" text-anchor="middle" font-size="${Math.max(8, Math.min(caption, size / (badges.length * 0.65)))}"`,
            ),
          );
      }
      output.push(
        `<g class="${token.excluded ? "excluded" : "included"}">${content.join("")}</g>`,
      );
      x += tokenWidth;
    }
    y += lineHeight;
    output.push(label(`Total: ${roll.total}`, padding, y, 'class="total"'));
    if (isHistory) {
      y += 26;
      output.push(
        `<path d="M${padding} ${y}H${width - padding}" class="divider"/>`,
      );
      y += 30;
    }
    if (y <= start) throw new Error("Invalid layout");
  }
  if (isHistory)
    output.push(
      label(`History total: ${target.total}`, padding, y + 6, 'class="total"'),
    );
  const height = y + (isHistory ? 30 : padding);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="result-preview" role="img" aria-label="Dice results preview" style="color:${appearance.stroke};font-family:system-ui,sans-serif"><title>Dice results preview</title><desc>Evaluated results with arithmetic, modifiers and individual dice. Excluded results are crossed out.</desc><style>.result-preview .die-outline{fill:${appearance.filled ? appearance.fill : "none"}}.result-preview .die-value{font-weight:600}.result-preview .math{fill:currentColor}.result-preview .caption,.result-preview .badge,.result-preview .notation{fill:currentColor}.result-preview .notation{font-size:14px}.result-preview .total{fill:currentColor;font-size:20px;font-weight:700}.result-preview .excluded{opacity:.4}.result-preview .divider{stroke:currentColor;stroke-opacity:.15}</style>${output.join("")}</svg>`;
}

/** Formats v6 rolls, histories and expression results without evaluating them. */
export class SvgPresenter implements Presenter<string> {
  readonly artwork: Readonly<Record<string, string>>;
  readonly appearance: Appearance;

  constructor(
    artwork: Readonly<Record<string, string>>,
    appearance: Partial<Appearance> = {},
  ) {
    this.artwork = Object.freeze({ ...artwork });
    this.appearance = Object.freeze({
      size: 140,
      stroke: "#7962b5",
      fill: "#eee7fb",
      filled: false,
      showValues: true,
      ...appearance,
    });
  }

  present(target: Presentable | SvgHistory | SvgRoll): string {
    if ("type" in target) {
      return renderSvg(
        { notation: "Expression", result: target, total: target.value },
        this.artwork,
        this.appearance,
      );
    }

    return renderSvg(target, this.artwork, this.appearance);
  }
}
