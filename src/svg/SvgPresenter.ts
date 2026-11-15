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
  readonly showDescriptions?: boolean;
  readonly showDiceLabels?: boolean;
  readonly showModifierLabels?: boolean;
  readonly showNotation?: boolean;
  readonly showTotals?: boolean;
}

type Token =
  | { kind: "description"; value: string; excluded: boolean }
  | {
      kind: "block";
      scope: "pool" | "group";
      value: string;
      children: Token[];
      excluded: boolean;
    }
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
  showDescriptions = true,
  showModifierLabels = true,
): Token[] {
  const body = expressionTokens(
    result,
    excluded,
    minimum,
    showDescriptions,
    showModifierLabels,
  );
  const description =
    result.type === "pool" || result.type === "group"
      ? result.node.description
      : undefined;
  if (!showDescriptions || !description) return body;
  return description.style === "block"
    ? [
        {
          kind: "block",
          scope: result.type === "group" ? "group" : "pool",
          value: description.text,
          children: body,
          excluded,
        },
      ]
    : [...body, { kind: "description", value: description.text, excluded }];
}

function expressionTokens(
  result: ExpressionResult,
  excluded = false,
  minimum = 0,
  showDescriptions = true,
  showModifierLabels = true,
): Token[] {
  const visit = (node: ExpressionResult, dropped = excluded, precedence = 0) =>
    tokens(node, dropped, precedence, showDescriptions, showModifierLabels);
  const text = (value: string): Token => ({ kind: "text", value, excluded });
  const join = (
    items: readonly ExpressionResult[],
    separator: string,
  ): Token[] =>
    items.flatMap((item, index) => [
      ...(index ? [text(separator)] : []),
      ...visit(item, excluded),
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
      return [text("("), ...visit(result.inner, excluded), text(")")];
    case "function":
      return [
        text(`${result.node.name}(`),
        ...join(result.args, ","),
        text(")"),
      ];
    case "unary":
      return [text("−"), ...visit(result.operand, excluded, 3)];
    case "group":
      return [
        text("{"),
        ...result.members.flatMap((member, index) => {
          const dropped = excluded || !member.useInTotal;
          return [
            ...(index ? [text(",")] : []),
            ...visit(member.result, dropped),
            ...(showModifierLabels && markers(member)
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
        ...visit(result.left, excluded, precedence + (op === "^" ? 1 : 0)),
        text({ "*": "×", "/": "÷", "-": "−" }[op] ?? op),
        ...visit(result.right, excluded, precedence + (op === "^" ? 0 : 1)),
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
  const showDiceLabels = appearance.showDiceLabels !== false;
  const showModifierLabels = appearance.showModifierLabels !== false;
  const showNotation = appearance.showNotation !== false;
  const showTotals = appearance.showTotals !== false;
  const lineHeight =
    size +
    12 +
    (showDiceLabels ? caption + 4 : 0) +
    (showModifierLabels
      ? showDiceLabels
        ? caption * 2 + 12
        : caption + 4
      : 0);
  let y = padding;
  const output: string[] = [];
  const label = (
    value: string | number,
    x: number,
    top: number,
    options = "",
  ) => `<text x="${x}" y="${top}" ${options}>${escape(value)}</text>`;

  interface Box {
    width: number;
    height: number;
    axis: number;
    diceLeft?: number;
    diceRight?: number;
    paint: (x: number, y: number) => string;
  }

  // Descriptions wrap within their own pool/group, without shrinking the dice.
  const descriptionFont = Math.max(12, Math.min(16, caption));
  const descriptionLine = descriptionFont * 1.4;
  function wrapDescription(text: string, maxWidth: number): string[] {
    const limit = Math.max(1, Math.floor(maxWidth / (descriptionFont * 0.65)));
    return text.split(/\r\n|[\n\r\u2028\u2029]/).flatMap((paragraph) => {
      const lines: string[] = [];
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        for (let rest = word; rest;) {
          if (line && line.length + rest.length + 1 > limit) {
            lines.push(line);
            line = "";
          }
          const part = rest.slice(0, limit);
          rest = rest.slice(limit);
          line += (line ? " " : "") + part;
          if (rest) {
            lines.push(line);
            line = "";
          }
        }
      }
      lines.push(line);
      return lines;
    });
  }

  function layout(items: Token[], available: number): Box {
    const rows: Box[][] = [[]];
    let used = 0;
    for (const item of items) {
      const box = measure(item, available);
      if (used > 0 && used + box.width > available) {
        rows.push([]);
        used = 0;
      }
      rows[rows.length - 1]!.push(box);
      used += box.width;
    }
    const placed: { box: Box; x: number; y: number }[] = [];
    let height = 0;
    let widest = 0;
    let firstAxis = size / 2;
    for (const [index, row] of rows.entries()) {
      const axis = Math.max(0, ...row.map((box) => box.axis));
      if (!index) firstAxis = axis;
      let x = 0;
      for (const box of row) {
        placed.push({ box, x, y: height + axis - box.axis });
        x += box.width;
      }
      widest = Math.max(widest, x);
      height += axis + Math.max(0, ...row.map((box) => box.height - box.axis));
    }
    return {
      width: widest,
      height,
      axis: firstAxis,
      ...(placed.some(({ box }) => box.diceLeft !== undefined)
        ? {
            diceLeft: Math.min(
              ...placed
                .filter(({ box }) => box.diceLeft !== undefined)
                .map(({ box, x }) => x + box.diceLeft!),
            ),
            diceRight: Math.max(
              ...placed
                .filter(({ box }) => box.diceRight !== undefined)
                .map(({ box, x }) => x + box.diceRight!),
            ),
          }
        : {}),
      paint: (x, y) =>
        placed.map((item) => item.box.paint(x + item.x, y + item.y)).join(""),
    };
  }

  function measure(token: Token, available: number): Box {
    if (token.kind === "block" || token.kind === "description") {
      const child =
        token.kind === "block" ? layout(token.children, available) : undefined;
      const textWidth = Math.min(
        available,
        token.kind === "block"
          ? Math.max(
              child!.width,
              Math.min(260, token.value.length * descriptionFont * 0.65 + 12),
            )
          : 260,
      );
      const lines = wrapDescription(token.value, textWidth - 12);
      const labelWidth =
        Math.max(...lines.map((line) => line.length * descriptionFont * 0.65)) +
        12;
      const headingHeight = lines.length * descriptionLine + 6;
      // Pool headings follow their dice; group headings span the complete group.
      const centre = child
        ? token.kind === "block" &&
          token.scope === "pool" &&
          child.diceLeft !== undefined
          ? (child.diceLeft + child.diceRight!) / 2
          : child.width / 2
        : 0;
      const inset = child ? Math.max(0, labelWidth / 2 - centre) : 0;
      const boxWidth = child
        ? Math.max(child.width + inset, centre + inset + labelWidth / 2)
        : labelWidth;
      return {
        width: boxWidth,
        ...(child?.diceLeft !== undefined
          ? {
              diceLeft: child.diceLeft + inset,
              diceRight: child.diceRight! + inset,
            }
          : {}),
        height: headingHeight + (child?.height ?? 0),
        axis: child ? headingHeight + child.axis : headingHeight / 2,
        paint: (x, y) =>
          `<g class="${token.excluded ? "excluded" : "included"}"><text class="description" fill="currentColor" font-size="${descriptionFont}" text-anchor="${child ? "middle" : "start"}">${lines.map((line, index) => `<tspan x="${x + (child ? inset + centre : 6)}" y="${y + descriptionFont + index * descriptionLine}">${escape(line)}</tspan>`).join("")}</text></g>${child?.paint(x + inset, y + headingHeight) ?? ""}`,
      };
    }
    const tokenWidth =
      token.kind === "die"
        ? size + 12
        : Math.max(16, token.value.length * font * 0.62 + 10);
    return {
      width: tokenWidth,
      ...(token.kind === "die" ? { diceLeft: 6, diceRight: 6 + size } : {}),
      height: token.kind === "die" ? lineHeight : font + 4,
      axis: token.kind === "die" ? size / 2 : font / 2,
      paint: (x, y) => {
        const content: string[] = [];
        let data = "";
        if (token.kind === "text") {
          content.push(
            label(
              token.value,
              x + tokenWidth / 2,
              y + font / 2,
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
          const shape = artwork[key] ? key : "generic";
          const template = artwork[key] ?? artwork.generic;
          if (!template) throw new Error("Missing generic dice artwork");
          data = Object.entries({
            "die-type": pool.node.die.name,
            faces: pool.die.faceCount,
            notation: `d${pool.die.notation}`,
            shape,
            min: pool.die.min,
            max: pool.die.max,
            value: die.value,
            "initial-value": die.initialValue,
            "calculation-value": die.calculationValue,
            "use-in-total": die.useInTotal,
            excluded: token.excluded,
            flags: die.flags.join(" "),
          })
            .map(([name, value]) => ` data-${name}="${escape(String(value))}"`)
            .join("");
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
          if (showDiceLabels)
            content.push(
              label(
                dieLabel.length > 22 ? dieLabel.slice(0, 21) + "…" : dieLabel,
                dieX + size / 2,
                y + size + caption + 4,
                `class="caption" text-anchor="middle" font-size="${caption}"`,
              ),
            );
          const badges = markers(die);
          if (showModifierLabels && badges)
            content.push(
              label(
                badges,
                dieX + size / 2,
                y + size + (showDiceLabels ? caption * 2 + 10 : caption + 4),
                `class="badge" text-anchor="middle" font-size="${Math.max(8, Math.min(caption, size / (badges.length * 0.65)))}"`,
              ),
            );
        }
        return `<g class="${token.excluded ? "excluded" : "included"}"${data}>${content.join("")}</g>`;
      },
    };
  }

  const isHistory = "rolls" in target;
  const rolls = isHistory ? target.rolls : [target];
  for (const [index, roll] of rolls.entries()) {
    const start = y;
    const heading = isHistory
      ? `${index + 1}. ${roll.notation}`
      : roll.notation;
    // Wrap notation as text as well as wrapping the visual expression.
    const chunks = heading.match(/.{1,100}/g) ?? [heading];
    if (showNotation) {
      for (const chunk of chunks) {
        output.push(label(chunk, padding, y + 18, 'class="notation"'));
        y += 24;
      }
      y += 14;
    }
    const expression = layout(
      tokens(
        roll.result,
        false,
        0,
        appearance.showDescriptions !== false,
        showModifierLabels,
      ),
      width - padding * 2,
    );
    output.push(expression.paint(padding, y));
    y += expression.height;
    if (showTotals) {
      // Leave room for the total’s ascenders even after a text-only wrapped row.
      y += 24;
      output.push(label(`Total: ${roll.total}`, padding, y, 'class="total"'));
    }
    if (isHistory) {
      y += showTotals ? 26 : 12;
      output.push(
        `<path d="M${padding} ${y}H${width - padding}" class="divider"/>`,
      );
      y += 30;
    }
    if (y <= start) throw new Error("Invalid layout");
  }
  if (isHistory && showTotals)
    output.push(
      label(`History total: ${target.total}`, padding, y + 6, 'class="total"'),
    );
  const height = y + (isHistory && showTotals ? 30 : padding);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="result-preview" role="img" aria-label="Dice results" style="color:${appearance.stroke};font-family:system-ui,sans-serif">
    <title>Dice results</title>
    <desc>Evaluated results with arithmetic, modifiers and individual dice.</desc>
    <style>.result-preview .die-outline{pointer-events:all;fill:${appearance.filled ? appearance.fill : "none"}}.result-preview .die-value{font-weight:600}.result-preview .math{fill:currentColor}.result-preview .caption,.result-preview .badge,.result-preview .notation{fill:currentColor}.result-preview .notation{font-size:14px}.result-preview .description{font-weight:400;opacity:.8}.result-preview .total{fill:currentColor;font-size:20px;font-weight:700}.result-preview .excluded{opacity:.4}.result-preview .divider{stroke:currentColor;stroke-opacity:.15}</style>
    ${output.join("")}
</svg>`;
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
      showDescriptions: true,
      showDiceLabels: true,
      showModifierLabels: true,
      showNotation: true,
      showTotals: true,
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
