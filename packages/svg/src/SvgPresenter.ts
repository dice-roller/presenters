import {
  modifierIcons,
  modifierIconStyles,
  layoutModifierIcons,
  renderModifierCutout,
  renderModifierIcon,
} from "./modifier-icons.js";
import type { ModifierIconPosition } from "./modifier-icons.js";

let presentationSequence = 0;
import { defaultArtwork } from "./default-artwork.js";
import { fillValueSlot } from "./value-slot.js";
import { ast } from "@dice-roller/rpg-dice-roller";
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
export type SvgExpressionResult = ExpressionResult;
export type SvgRoll = Pick<RollData, "notation" | "total" | "result">;
export type SvgHistory = Pick<HistoryData, "total"> & {
  readonly rolls: readonly SvgRoll[];
};

export interface Appearance {
  readonly size: number;
  /** SVG width in drawing units, including 24 units of padding on each side. */
  readonly width?: number;
  /** Keep each roll expression on one line and size the SVG to its contents. */
  readonly noWrap?: boolean;
  readonly stroke: string;
  readonly fill: string;
  readonly filled: boolean;
  readonly showValues: boolean;
  readonly showDescriptions?: boolean;
  readonly showDiceLabels?: boolean;
  /** Show the name beneath each variable value, including system references. */
  readonly showVariableLabels?: boolean;
  readonly showModifierLabels?: boolean;
  readonly showModifierIcons?: boolean;
  readonly modifierIconPosition?: ModifierIconPosition;
  readonly showNotation?: boolean;
  readonly showTotals?: boolean;
}

/** Appearance settings and optional per-shape SVG template overrides. */
export interface SvgPresenterOptions extends Partial<Appearance> {
  readonly artwork?: Readonly<Record<string, string>>;
}

type Token =
  | {
      kind: "comparison";
      children: Token[];
      operator: string;
      value: number;
      excluded: boolean;
    }
  | {
      kind: "conditional";
      condition: Token[];
      selected: Token[];
      conditionValue: number;
      selectedBranch: "true" | "false";
      value: number;
      excluded: boolean;
    }
  | { kind: "reference"; notation: string; value: number; excluded: boolean }
  | { kind: "math-group"; children: Token[]; name?: string }
  | {
      kind: "group";
      children: Token[];
      result: Extract<ExpressionResult, { type: "group" }>;
      excluded: boolean;
    }
  | { kind: "pool"; children: Token[]; result: PoolResult; excluded: boolean }
  | { kind: "member"; children: Token[]; item: ScoredItem; excluded: boolean }
  | { kind: "description"; value: string; excluded: boolean }
  | {
      kind: "block";
      scope: "pool" | "group";
      value: string;
      children: Token[];
      excluded: boolean;
    }
  | {
      kind: "text";
      value: string;
      excluded: boolean;
      delimiter?: "function" | "open" | "close";
    }
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
  "explode-matching-batch": "!m",
  "explode-matching-batch-failure": "!mf",
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

function calculatedSelections(owner: PoolResult | results.GroupResult) {
  return (owner.modifierArguments ?? []).flatMap(
    ({ modifierIndex, result }) => {
      const modifier = owner.node.modifiers[modifierIndex];
      if (
        !modifier ||
        (modifier.name !== "keep" && modifier.name !== "drop") ||
        typeof modifier.qty === "number"
      )
        return [];

      const expression = ast.nodeToNotation(modifier.qty);
      const notation = `${modifier.name[0]}${modifier.end}${modifier.qty.type === "paren" ? expression : `(${expression})`}`;
      const action = modifier.name === "keep" ? "Keep" : "Drop";
      const end = modifier.end === "h" ? "highest" : "lowest";
      return [
        {
          modifierIndex,
          notation,
          quantity: result.value,
          caption: `${action} ${end} ${result.value}`,
          detail: `${notation} → ${result.value}`,
        },
      ];
    },
  );
}

function tokens(
  result: SvgExpressionResult,
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
  const described: Token[] =
    !showDescriptions || !description
      ? body
      : description.style === "block"
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
  return result.type === "pool"
    ? [{ kind: "pool", children: described, result, excluded }]
    : result.type === "group"
      ? [{ kind: "group", children: described, result, excluded }]
      : described;
}

function expressionTokens(
  result: SvgExpressionResult,
  excluded = false,
  minimum = 0,
  showDescriptions = true,
  showModifierLabels = true,
): Token[] {
  const visit = (
    node: SvgExpressionResult,
    dropped = excluded,
    precedence = 0,
  ) => tokens(node, dropped, precedence, showDescriptions, showModifierLabels);
  const text = (value: string): Token => ({ kind: "text", value, excluded });
  const pair = (children: Token[], name?: string): Token[] => [
    {
      kind: "math-group",
      name,
      children: [
        {
          kind: "text",
          value: `${name ?? ""}(`,
          excluded,
          delimiter: name ? "function" : "open",
        },
        ...children,
        { kind: "text", value: ")", excluded, delimiter: "close" },
      ],
    },
  ];
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
    case "reference":
      return [
        {
          kind: "reference",
          notation: ast.nodeToNotation(result.node),
          value: result.value,
          excluded,
        },
      ];
    case "comparison": {
      const operator =
        {
          "<=": "≤",
          ">=": "≥",
          "!=": "≠",
          "<>": "≠",
          "<": "<",
          ">": ">",
          "=": "=",
        }[result.node.op] ?? result.node.op;
      const body: Token[] = [
        {
          kind: "comparison",
          children: [
            ...visit(result.left, excluded, 1),
            text(operator),
            ...visit(result.right, excluded, 1),
          ],
          operator: result.node.op,
          value: result.value,
          excluded,
        },
      ];
      return minimum > 0 ? pair(body) : body;
    }
    case "conditional":
      return [
        {
          kind: "conditional",
          condition: visit(result.condition),
          selected: visit(result.selectedResult),
          conditionValue: result.condition.value,
          selectedBranch: result.selectedBranch,
          value: result.value,
          excluded,
        },
      ];
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
      return pair(visit(result.inner, excluded));
    case "function":
      return pair(join(result.args, ","), result.node.name);
    case "unary":
      return [text("−"), ...visit(result.operand, excluded, 3)];
    case "group":
      return [
        text("{"),
        ...result.members.flatMap((member, index) => {
          const dropped = excluded || !member.useInTotal;
          const children = visit(member.result, dropped);
          return [
            ...(index ? [text(",")] : []),
            {
              kind: "member" as const,
              children,
              item: member,
              excluded: dropped,
            },
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
      return precedence < minimum ? pair(body) : body;
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
  const position = appearance.modifierIconPosition ?? "corner";
  if (position !== "corner" && position !== "below")
    throw new Error("Invalid modifier icon position");
  const prefix = `dice-${++presentationSequence}`;
  let identifier = 0;
  const nextId = () => `${prefix}-${++identifier}`;
  const size = appearance.size;
  const iconSize = Math.max(16, Math.min(38, size * 0.192));
  const visibleIcons = (flags: readonly string[]) =>
    appearance.showModifierIcons === false ? [] : modifierIcons(flags);
  const padding = 24;
  const wrapWidth = appearance.width ?? 1040;
  if (!Number.isFinite(wrapWidth) || wrapWidth <= padding * 2)
    throw new Error("SVG width must be finite and greater than 48");
  const noWrap = appearance.noWrap === true;
  const availableWidth = noWrap ? Infinity : wrapWidth - padding * 2;
  const font = Math.max(14, Math.min(32, size * 0.2));
  const caption = Math.max(10, Math.min(16, size * 0.12));
  const showDiceLabels = appearance.showDiceLabels !== false;
  const showVariableLabels = appearance.showVariableLabels !== false;
  const showModifierLabels = appearance.showModifierLabels !== false;
  const showNotation = appearance.showNotation !== false;
  const showTotals = appearance.showTotals !== false;
  let y = padding;
  const output: string[] = [];
  const label = (
    value: string | number,
    x: number,
    top: number,
    options = "",
  ) => `<text x="${x}" y="${top}" ${options}>${escape(value)}</text>`;
  const hoverOutline = (x: number, y: number, width: number, height: number) =>
    `<rect class="result-hover-outline" x="${x + 1}" y="${y + 1}" width="${Math.max(0, width - 2)}" height="${Math.max(0, height - 2)}" rx="6" pointer-events="none"/>`;

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
  // Comments and function names use a proportional font; equal-width character
  // estimates leave conspicuous gaps after narrow letters.
  function proportionalTextWidth(text: string, fontSize: number): number {
    return [...text].reduce((width, character) => {
      const em = /\s/.test(character)
        ? 0.32
        : /[ilI.,'!|]/.test(character)
          ? 0.28
          : /[ftr()\[\]]/.test(character)
            ? 0.4
            : /[mwMW@]/.test(character)
              ? 0.9
              : /[A-Z]/.test(character)
                ? 0.7
                : 0.6;
      return width + em * fontSize;
    }, 0);
  }
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
    if (token.kind === "comparison") {
      const child = layout(token.children, available);
      const outcome = `${token.value !== 0 ? "true" : "false"} · ${token.value}`;
      const boxWidth = Math.max(
        child.width,
        proportionalTextWidth(outcome, caption) + 16,
      );
      const inset = (boxWidth - child.width) / 2;
      return {
        ...child,
        width: boxWidth,
        height: child.height + caption * 1.5 + 8,
        ...(child.diceLeft !== undefined
          ? {
              diceLeft: child.diceLeft + inset,
              diceRight: child.diceRight! + inset,
            }
          : {}),
        paint: (x, y) =>
          `<g class="comparison-result" data-operator="${escape(token.operator)}" data-value="${token.value}" data-truth="${token.value !== 0}" data-excluded="${token.excluded}"><title>${escape(`Comparison: ${token.operator}; ${outcome}`)}</title><rect x="${x}" y="${y}" width="${boxWidth}" height="${child.height + caption * 1.5 + 8}" fill="transparent" pointer-events="all"/>${hoverOutline(x, y, boxWidth, child.height + caption * 1.5 + 8)}${child.paint(x + inset, y)}${label(outcome, x + boxWidth / 2, y + child.height + caption + 4, `class="decision-label comparison-outcome${token.excluded ? " excluded" : ""}" text-anchor="middle" font-size="${caption}"`)}</g>`,
      };
    }
    if (token.kind === "conditional") {
      const truth = token.conditionValue !== 0;
      const pad = 10;
      const headingHeight = caption * 1.5 + 6;
      const gap = 32;
      const card = (
        children: Token[],
        heading: string,
        part: string,
        details: string,
      ): Box => {
        const child = layout(children, Math.max(1, available - pad * 2));
        const width = Math.max(
          child.width + pad * 2,
          proportionalTextWidth(heading, caption) + pad * 2,
        );
        return {
          width,
          height: child.height + headingHeight + pad * 2,
          axis: headingHeight + pad + child.axis,
          paint: (x, y) =>
            `<g class="conditional-part-result" data-part="${part}"><title>${escape(details)}</title><rect class="conditional-card${token.excluded ? " excluded" : ""}" x="${x}" y="${y}" width="${width}" height="${child.height + headingHeight + pad * 2}" rx="8"/>${hoverOutline(x, y, width, child.height + headingHeight + pad * 2)}${label(heading, x + pad, y + pad + caption, `class="decision-label${token.excluded ? " excluded" : ""}" font-size="${caption}"`)}${child.paint(x + (width - child.width) / 2, y + headingHeight + pad)}</g>`,
        };
      };
      const condition = card(
        token.condition,
        `IF · ${truth ? "true" : "false"}`,
        "condition",
        `Condition: ${token.conditionValue}; ${truth ? "true (non-zero)" : "false (zero)"}`,
      );
      const selected = card(
        token.selected,
        token.selectedBranch === "true" ? "THEN" : "ELSE",
        "selected-branch",
        `Selected branch; result ${token.value}`,
      );
      const horizontal = condition.width + gap + selected.width <= available;
      const axis = horizontal
        ? Math.max(condition.axis, selected.axis)
        : condition.height + gap + selected.axis;
      const leftY = horizontal ? axis - condition.axis : 0;
      const rightX = horizontal ? condition.width + gap : 0;
      const rightY = horizontal ? axis - selected.axis : condition.height + gap;
      const width = horizontal
        ? condition.width + gap + selected.width
        : Math.max(condition.width, selected.width);
      const height = Math.max(
        leftY + condition.height,
        rightY + selected.height,
      );
      const details = `Conditional: condition ${token.conditionValue} (${truth ? "true" : "false"}); ${token.selectedBranch === "true" ? "then" : "else"} branch selected; result ${token.value}; ${token.selectedBranch === "true" ? "else" : "then"} branch not evaluated`;
      return {
        width,
        height,
        axis,
        paint: (x, y) =>
          `<g class="conditional-result" data-condition-value="${token.conditionValue}" data-selected-branch="${token.selectedBranch}" data-value="${token.value}" data-layout="${horizontal ? "horizontal" : "vertical"}" data-excluded="${token.excluded}"><title>${escape(details)}</title><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="transparent" pointer-events="all"/>${hoverOutline(x, y, width, height)}${condition.paint(x, y + leftY)}${label(horizontal ? "→" : "↓", x + (horizontal ? condition.width + gap / 2 : width / 2), y + (horizontal ? axis : condition.height + gap / 2), `class="decision-arrow${token.excluded ? " excluded" : ""}" text-anchor="middle" dominant-baseline="central" font-size="${font}"`)}${selected.paint(x + rightX, y + rightY)}</g>`,
      };
    }
    if (token.kind === "reference") {
      const width = Math.max(
        String(token.value).length * font * 0.62 + 14,
        showVariableLabels
          ? proportionalTextWidth(token.notation, caption) + 12
          : 0,
      );
      return {
        width,
        height: font + 6 + (showVariableLabels ? caption * 1.5 + 6 : 0),
        axis: font / 2 + 3,
        paint: (x, y) =>
          `<g class="condition-reference-result${token.excluded ? " excluded" : ""}" data-value="${token.value}"><title>${escape(`${token.notation}: ${token.value}`)}</title><rect class="condition-reference-outline" x="${x + 2}" y="${y}" width="${width - 4}" height="${font + 6}" rx="5"/>${label(token.value, x + width / 2, y + font / 2 + 3, `class="math" text-anchor="middle" dominant-baseline="central" font-size="${font}"`)}${showVariableLabels ? label(token.notation, x + width / 2, y + font + caption + 8, `class="decision-label" text-anchor="middle" font-size="${caption}"`) : ""}</g>`,
      };
    }
    if (token.kind === "math-group") {
      const child = layout(token.children, available);
      return {
        ...child,
        paint: (x, y) =>
          `<g class="math-group-result" data-math-group="${token.name ? "function" : "parentheses"}"${token.name ? ` data-function="${escape(token.name)}"` : ""}>${child.paint(x, y)}</g>`,
      };
    }
    if (token.kind === "group" || token.kind === "pool") {
      const child = layout(token.children, available);
      const owner = token.result;
      const notation = ast.nodeToNotation({
        ...owner.node,
        description: undefined,
      });
      const items = owner.type === "pool" ? owner.rolls : owner.members;
      const counted = items.filter((item) => item.useInTotal).length;
      const isPool = owner.type === "pool";
      const kind = isPool ? "dice-pool" : "roll-group";
      const scope = isPool ? "Dice pool" : "Roll group";
      const noun = isPool
        ? items.length === 1
          ? "result"
          : "results"
        : "members";
      const selections = calculatedSelections(owner);
      const calculationDetails = selections
        .map(({ detail }) => `; ${detail}`)
        .join("");
      const details = `${scope}: ${notation}; ${items.length} ${noun}; ${counted} counted; total ${owner.value}${token.excluded ? "; excluded by enclosing group" : ""}${calculationDetails}`;
      const metadata = isPool
        ? `data-pool="true" data-notation="${escape(notation)}" data-quantity="${owner.qty.value}" data-result-count="${items.length}"`
        : `data-group="true" data-notation="${escape(notation)}" data-member-count="${items.length}"`;
      let height = child.height;
      const lineHeight = caption * 1.4;
      const captions = (showModifierLabels ? selections : []).map(
        (selection) => {
          const lines = wrapDescription(selection.caption, child.width - 12);
          const top = height + 6;
          height = top + lines.length * lineHeight;
          return { ...selection, lines, top };
        },
      );
      return {
        ...child,
        height,
        paint: (x, y) => {
          const annotations = captions
            .map(
              ({ modifierIndex, notation, quantity, detail, lines, top }) =>
                `<text class="caption calculated-selection-label${token.excluded ? " excluded" : ""}" data-modifier-index="${modifierIndex}" data-notation="${escape(notation)}" data-quantity="${quantity}" text-anchor="middle" font-size="${caption}"><title>${escape(detail)}</title>${lines.map((line, i) => `<tspan x="${x + child.width / 2}" y="${y + top + caption + i * lineHeight}">${escape(line)}</tspan>`).join("")}</text>`,
            )
            .join("");
          // Keep the hit area behind children: dice and icons own their tooltips.
          return `<g class="${kind}-result" ${metadata} data-counted-count="${counted}" data-value="${owner.value}"><title>${escape(details)}</title><rect class="${kind}-hit-area" x="${x}" y="${y}" width="${child.width}" height="${height}" fill="transparent" stroke="none" pointer-events="all"/>${hoverOutline(x, y, child.width, height)}${child.paint(x, y)}${annotations}</g>`;
        },
      };
    }
    if (token.kind === "member") {
      const names = visibleIcons(token.item.flags);
      const memberLabel = showModifierLabels ? markers(token.item) : "";
      const reserve =
        names.length && position === "corner"
          ? Math.max(6, iconSize * 0.65 + 5)
          : 0;
      const child = layout(
        token.children,
        Math.max(1, available - reserve * 2),
      );
      // Member labels and punctuation can extend well beyond the dice. Anchor
      // corner flags to the artwork, rather than the complete member box.
      const iconLeft = position === "corner" ? (child.diceLeft ?? 0) : 0;
      const iconWidth =
        position === "corner" && child.diceRight !== undefined
          ? child.diceRight - iconLeft
          : child.width;
      const iconLayout = layoutModifierIcons(
        names,
        iconWidth,
        child.height,
        iconSize,
        position,
      );
      const icons = {
        ...iconLayout,
        padding: names.length ? iconLayout.padding : 0,
        items: iconLayout.items.map((icon) => ({
          ...icon,
          x: icon.x + iconLeft,
        })),
      };
      const labelLines = memberLabel
        ? wrapDescription(
            memberLabel,
            (child.width * descriptionFont) / caption,
          )
        : [];
      const labelTop = child.height + icons.bottom + 4;
      const memberWidth = child.width + icons.padding * 2;
      const memberHeight =
        child.height +
        icons.top +
        icons.bottom +
        (labelLines.length ? 4 + labelLines.length * caption * 1.4 : 0);
      return {
        width: memberWidth,
        height: memberHeight,
        axis: child.axis + icons.top,
        ...(child.diceLeft !== undefined
          ? {
              diceLeft: child.diceLeft + icons.padding,
              diceRight: child.diceRight! + icons.padding,
            }
          : {}),
        paint: (x, y) => {
          const id = nextId();
          const mask =
            names.length && position === "corner"
              ? renderModifierCutout(id, icons.items, child.width, child.height)
              : "";
          const details = `Group member: ${token.item.value}; contribution ${token.excluded ? 0 : token.item.calculationValue}; ${token.item.flags.join(", ")}`;
          const annotation = labelLines
            .map((line, index) =>
              label(
                line,
                child.width / 2,
                labelTop + caption + index * caption * 1.4,
                `class="group-member-label badge${token.excluded ? " excluded" : ""}" text-anchor="middle" font-size="${caption}"`,
              ),
            )
            .join("");
          // Paint the hit area first, outside the artwork mask, so empty space
          // inherits this title while later dice/icons keep their own tooltips.
          const hitArea = `<rect class="group-member-hit-area" x="${-icons.padding}" y="${-icons.top}" width="${memberWidth}" height="${memberHeight}" fill="transparent" stroke="none" pointer-events="all"/>${hoverOutline(-icons.padding, -icons.top, memberWidth, memberHeight)}`;
          return `<g class="group-member-result" data-group-member="true" data-flags="${escape(token.item.flags.join(" "))}" data-excluded="${token.excluded}" transform="translate(${x + icons.padding} ${y + icons.top})"><title>${escape(details)}</title>${hitArea}${mask}<g class="group-member-artwork"${mask ? ` mask="url(#${id})"` : ""}>${child.paint(0, 0)}</g><g class="modifier-flags${token.excluded ? " excluded" : ""}">${icons.items.map((icon) => renderModifierIcon(icon, nextId())).join("")}</g>${annotation}</g>`;
        },
      };
    }
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
        Math.max(
          ...lines.map((line) =>
            token.kind === "description"
              ? proportionalTextWidth(line, descriptionFont)
              : line.length * descriptionFont * 0.65,
          ),
        ) + 12;
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
    const icons = layoutModifierIcons(
      token.kind === "die" ? visibleIcons(token.roll.flags) : [],
      size,
      size,
      iconSize,
      position,
    );
    const tokenWidth =
      token.kind === "die"
        ? size + icons.padding * 2
        : Math.max(
            16,
            (token.delimiter === "function"
              ? proportionalTextWidth(token.value, font)
              : token.value.length * font * 0.62) + 10,
          );
    return {
      width: tokenWidth,
      ...(token.kind === "die"
        ? { diceLeft: icons.padding, diceRight: icons.padding + size }
        : {}),
      height:
        token.kind === "die"
          ? size +
            12 +
            icons.top +
            icons.bottom +
            (showModifierLabels && markers(token.roll)
              ? showDiceLabels
                ? caption * 2 + 10
                : caption + 4
              : showDiceLabels
                ? caption + 4
                : 0)
          : font + 4,
      axis: token.kind === "die" ? size / 2 + icons.top : font / 2,
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
          if (token.delimiter === "function") {
            const name = token.value.slice(0, -1);
            content[0] = content[0]!.replace(
              `>${escape(token.value)}</text>`,
              `><tspan class="math-function-name">${escape(name)}</tspan><tspan>(</tspan></text>`,
            );
          }
        } else {
          // Centre the artwork within its padded token, just like text tokens.
          const dieX = x + (tokenWidth - size) / 2;
          const dieTop = y + icons.top;
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
          const maskId = nextId();
          const mask =
            icons.items.length && position === "corner"
              ? renderModifierCutout(
                  maskId,
                  icons.items,
                  size,
                  size,
                  100 / size,
                )
              : "";
          const struck = token.excluded
            ? '<path d="M14 50h72" stroke="currentColor" stroke-width="2"/>'
            : "";
          content.push(
            `<title>${escape(details)}</title><svg x="${dieX}" y="${dieTop}" width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${mask}<g class="die-artwork"${mask ? ` mask="url(#${maskId})"` : ""}>${fillValueSlot(body, appearance.showValues ? value : "")}${struck}</g></svg>`,
            ...icons.items.map((icon) =>
              renderModifierIcon(icon, nextId(), dieX, dieTop),
            ),
          );
          const dieLabel = `d${pool.die.notation}`;
          if (showDiceLabels)
            content.push(
              label(
                dieLabel.length > 22 ? dieLabel.slice(0, 21) + "…" : dieLabel,
                dieX + size / 2,
                dieTop + size + icons.bottom + caption + 4,
                `class="caption" text-anchor="middle" font-size="${caption}"`,
              ),
            );
          const badges = markers(die);
          if (showModifierLabels && badges)
            content.push(
              label(
                badges,
                dieX + size / 2,
                dieTop +
                  size +
                  icons.bottom +
                  (showDiceLabels ? caption * 2 + 10 : caption + 4),
                `class="badge" text-anchor="middle" font-size="${Math.max(8, Math.min(caption, size / (badges.length * 0.65)))}"`,
              ),
            );
        }
        return `<g class="${token.excluded ? "excluded" : "included"}${token.kind === "text" && token.delimiter ? " math-delimiter" : ""}"${token.kind === "text" && token.delimiter ? ` data-delimiter="${token.delimiter}"` : ""}${data}>${content.join("")}</g>`;
      },
    };
  }

  const isHistory = "rolls" in target;
  const rolls = isHistory ? target.rolls : [target];
  function notationLines(heading: string): string[] {
    if (noWrap) return [heading.replace(/\s/g, " ")];
    const lines: string[] = [];
    let line = "";
    let used = 0;
    for (const character of heading) {
      const next = proportionalTextWidth(character, 14);
      if (character === "\n" || (line && used + next > availableWidth)) {
        lines.push(line);
        line = "";
        used = 0;
      }
      if (character !== "\n") {
        line += character;
        used += next;
      }
    }
    lines.push(line);
    return lines;
  }

  // Measure all rolls first so histories share a width and full-width dividers.
  const prepared = rolls.map((roll, index) => {
    const heading = isHistory
      ? `${index + 1}. ${roll.notation}`
      : roll.notation;
    return {
      roll,
      chunks: showNotation ? notationLines(heading) : [],
      expression: layout(
        tokens(
          roll.result,
          false,
          0,
          appearance.showDescriptions !== false,
          showModifierLabels,
        ),
        availableWidth,
      ),
    };
  });
  const totalWidth = (value: number) =>
    proportionalTextWidth(`Total: ${value}`, 20) * 1.15;
  const contentWidth = prepared.reduce(
    (widest, { roll, chunks, expression }) =>
      Math.max(
        widest,
        expression.width,
        ...chunks.map((chunk) => proportionalTextWidth(chunk, 14)),
        showTotals ? totalWidth(roll.total) : 0,
      ),
    isHistory && showTotals
      ? proportionalTextWidth(`History total: ${target.total}`, 20) * 1.15
      : 1,
  );
  const width = noWrap ? Math.ceil(contentWidth + padding * 2) : wrapWidth;

  for (const { roll, chunks, expression } of prepared) {
    const start = y;
    if (showNotation) {
      for (const chunk of chunks) {
        output.push(label(chunk, padding, y + 18, 'class="notation"'));
        y += 24;
      }
      y += 14;
    }
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
    <style>.result-preview .die-outline{pointer-events:all;fill:${appearance.filled ? appearance.fill : "none"}}.result-preview .die-value{font-weight:600}${modifierIconStyles}.result-preview .decision-label,.result-preview .decision-arrow{fill:currentColor}.result-preview .decision-label{font-weight:500}.result-preview .conditional-card{fill:transparent;stroke:currentColor;stroke-opacity:.28;stroke-width:1;pointer-events:all}.result-preview .condition-reference-outline{fill:transparent;stroke:currentColor;stroke-opacity:.5;stroke-dasharray:3 2;pointer-events:all}.result-preview .result-hover-outline{fill:var(--result-hover-color,currentColor);fill-opacity:0;stroke:var(--result-hover-color,currentColor);stroke-opacity:0;stroke-width:1;pointer-events:none}.result-preview :is(.dice-pool-result,.group-member-result,.roll-group-result,.comparison-result,.conditional-result,.conditional-part-result):hover:not(:has(:is(.dice-pool-result,.group-member-result,.roll-group-result,.comparison-result,.conditional-result,.conditional-part-result):hover))>.result-hover-outline{fill-opacity:var(--result-hover-fill-opacity,.05);stroke-opacity:var(--result-hover-stroke-opacity,.45)}.result-preview .math{fill:currentColor}.result-preview .math-group-result:has(>.math-delimiter:hover)>.math-delimiter .math{fill:var(--math-hover-color,var(--result-hover-color,currentColor));filter:brightness(1.6)}.result-preview .caption,.result-preview .badge,.result-preview .notation{fill:currentColor}.result-preview .notation{font-size:14px}.result-preview .description{font-weight:400;opacity:.8}.result-preview .total{fill:currentColor;font-size:20px;font-weight:700}.result-preview .excluded{opacity:.4}.result-preview .divider{stroke:currentColor;stroke-opacity:.15}</style>
    ${output.join("")}
</svg>`;
}

/** Formats v6 rolls, histories and expression results without evaluating them. */
export class SvgPresenter implements Presenter<string> {
  readonly artwork: Readonly<Record<string, string>>;
  readonly appearance: Appearance;

  /** Supplied templates override individual shapes in the bundled artwork. */
  constructor(options: SvgPresenterOptions = {}) {
    const { artwork, ...appearance } = options;
    this.artwork = Object.freeze({ ...defaultArtwork, ...artwork });
    this.appearance = Object.freeze({
      size: 140,
      width: 1040,
      noWrap: false,
      stroke: "#7962b5",
      fill: "#eee7fb",
      filled: false,
      showValues: true,
      showDescriptions: true,
      showDiceLabels: true,
      showVariableLabels: true,
      showModifierLabels: true,
      showModifierIcons: true,
      modifierIconPosition: "corner",
      showNotation: true,
      showTotals: true,
      ...appearance,
    });
  }

  present(
    target: Presentable | SvgExpressionResult | SvgHistory | SvgRoll,
  ): string {
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
