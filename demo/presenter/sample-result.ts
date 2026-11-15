import type {
  ExpressionResult,
  ast,
  results,
} from "@dice-roller/rpg-dice-roller";
import type { SvgHistory, SvgRoll } from "../../src/svg/index.js";
type PoolResult = results.PoolResult;
type ScoredItem = results.ScoredItem;

const number = (value: number): results.NumberResult => ({
  type: "number",
  node: { type: "number", value },
  value,
});
const die = (
  value: number,
  flags: results.ResultFlag[] = [],
  useInTotal = true,
  calculationValue = value,
  initialValue = value,
) => ({
  type: "die" as const,
  value,
  initialValue,
  flags,
  useInTotal,
  calculationValue,
});

function pool(
  notation: string,
  faceCount: number,
  rolls: ReturnType<typeof die>[],
  modifiers: ast.ModifierNode[] = [],
  args?: number[],
  description?: ast.DescriptionNode,
): PoolResult {
  const fudge = notation.startsWith("F");
  const name = fudge
    ? "fudge"
    : notation === "%"
      ? "percentile"
      : notation.startsWith("{")
        ? notation.includes(",")
          ? "face"
          : "range"
        : "standard";
  const values = args ?? (name === "standard" ? [faceCount] : []);
  const min = fudge
    ? -1
    : name === "range"
      ? values[0]!
      : name === "face"
        ? Math.min(...values)
        : 1;
  const max = fudge
    ? 1
    : name === "range"
      ? values[1]!
      : name === "face"
        ? Math.max(...values)
        : faceCount;
  const qty = number(rolls.length);
  const dieArgs = values.map(number);
  return {
    type: "pool",
    node: {
      type: "pool",
      qty: qty.node,
      die: { type: "die", name, args: dieArgs.map((arg) => arg.node) },
      modifiers,
      ...(description ? { description } : {}),
    },
    qty,
    dieArgs,
    die: {
      notation,
      faceCount,
      min,
      max,
      average: fudge
        ? 0
        : name === "face"
          ? values.reduce((a, b) => a + b, 0) / values.length
          : (min + max) / 2,
    },
    rolls,
    value: rolls.reduce(
      (sum, roll) => sum + (roll.useInTotal ? roll.calculationValue : 0),
      0,
    ),
  };
}

function binary(
  op: ast.BinaryOperator,
  left: ExpressionResult,
  right: ExpressionResult,
): ExpressionResult {
  const values: Record<string, () => number> = {
    "+": () => left.value + right.value,
    "-": () => left.value - right.value,
    "*": () => left.value * right.value,
    "/": () => left.value / right.value,
    "%": () => left.value % right.value,
    "^": () => left.value ** right.value,
  };
  return {
    type: "binary",
    node: { type: "binary", op, left: left.node, right: right.node },
    left,
    right,
    value: values[op]!(),
  };
}

const paren = (inner: ExpressionResult): ExpressionResult => ({
  type: "paren",
  node: { type: "paren", expression: inner.node },
  inner,
  value: inner.value,
});
const unary = (operand: ExpressionResult): ExpressionResult => ({
  type: "unary",
  node: { type: "unary", op: "-", operand: operand.node },
  operand,
  value: -operand.value,
});
const fn = (
  name: ast.MathFunctionName,
  args: ExpressionResult[],
  value: number,
): ExpressionResult => ({
  type: "function",
  node: { type: "function", name, args: args.map((arg) => arg.node) },
  args,
  value,
});
const member = (
  result: ExpressionResult,
  flags: results.ResultFlag[] = [],
  useInTotal = true,
): ScoredItem & { type: "group-member"; result: ExpressionResult } => ({
  type: "group-member",
  result,
  value: result.value,
  calculationValue: result.value,
  useInTotal,
  flags,
});

const mixedDice: ExpressionResult[] = [
  pool("2", 2, [die(2)]),
  pool("4", 4, [die(3)]),
  pool("6", 6, [die(5)]),
  pool("8", 8, [die(7)]),
  pool("10", 10, [die(9)]),
  pool("12", 12, [die(11)]),
  pool("20", 20, [die(17)]),
  pool("%", 100, [die(83)]),
  pool("F", 3, [die(-1), die(0), die(1)]),
  pool("13", 13, [die(12)]),
];
const mixed = mixedDice.reduce((left, right) => binary("+", left, right));

const maths = fn(
  "floor",
  [
    binary(
      "/",
      paren(binary("+", pool("8", 8, [die(5)]), number(3))),
      number(2),
    ),
  ],
  4,
);
const keep = binary(
  "+",
  pool(
    "6",
    6,
    [die(6), die(5), die(3), die(1, ["drop"], false)],
    [{ type: "modifier", name: "keep", end: "h", qty: 3 }],
  ),
  number(2),
);
const explode = pool(
  "6",
  6,
  [die(6, ["explode"]), die(4)],
  [{ type: "modifier", name: "explode", compound: false, penetrate: false }],
);
// Explosion flags mark the triggering result, so this pool started with one die.
const exploding = {
  ...explode,
  qty: number(1),
  node: { ...explode.node, qty: number(1).node },
};
const reroll = pool(
  "8",
  8,
  [die(5, ["re-roll"], true, 5, 1)],
  [
    {
      type: "modifier",
      name: "re-roll",
      once: false,
      comparePoint: { operator: "=", value: 1 },
    },
  ],
);
const targets = pool(
  "10",
  10,
  [
    die(10, ["target-success"], true, 2),
    die(8, ["target-success"], true, 1),
    die(1, ["target-failure"], true, -1),
    die(4, [], true, 0),
  ],
  [
    {
      type: "modifier",
      name: "target",
      rules: [
        { kind: "success", comparePoint: { operator: ">=", value: 8 } },
        {
          kind: "success",
          comparePoint: { operator: "=", value: 10 },
          amount: 2,
        },
        { kind: "failure", comparePoint: { operator: "=", value: 1 } },
      ],
    },
  ],
);
const criticals = pool(
  "20",
  20,
  [die(20, ["critical-success"]), die(1, ["critical-failure"])],
  [
    { type: "modifier", name: "critical-success" },
    { type: "modifier", name: "critical-failure" },
  ],
);
const members = [
  member(
    pool("12", 12, [die(10)], [], undefined, {
      text: "Weapon damage",
      style: "block",
    }),
  ),
  member(
    pool("20", 20, [die(7)], [], undefined, {
      text: "Alternative",
      style: "inline",
    }),
    ["drop"],
    false,
  ),
];
const group: ExpressionResult = {
  type: "group",
  node: {
    type: "group",
    description: { text: "Keep the higher result", style: "block" },
    expressions: members.map((item) => item.result.node),
    modifiers: [{ type: "modifier", name: "keep", end: "h", qty: 1 }],
  },
  members,
  value: 10,
};
const custom = binary(
  "+",
  binary(
    "+",
    pool("{0:5}", 6, [die(0)], [], [0, 5]),
    pool("{1,1,2,3,5,8}", 6, [die(8)], [], [1, 1, 2, 3, 5, 8]),
  ),
  pool("{10,20}", 2, [die(20)], [], [10, 20]),
);

/** Fixed v6-shaped results. No RNG, parser or roll evaluator runs in the demo. */
const rolls = [
  {
    notation: "d2 + d4 + d6 + d8 + d10 + d12 + d20 + d% + 3dF + d13",
    result: mixed,
  },
  {
    notation: "floor((d8 + 3) / 2) * 2 - -d4 + 2^3 % 3",
    result: binary(
      "+",
      binary("-", binary("*", maths, number(2)), unary(pool("4", 4, [die(3)]))),
      binary("%", binary("^", number(2), number(3)), number(3)),
    ),
  },
  { notation: "4d6kh3 + 2", result: keep },
  { notation: "d6! + d8r=1", result: binary("+", exploding, reroll) },
  { notation: "4d10>=8=10:2f=1", result: targets },
  { notation: "2d20cs=20cf=1", result: criticals },
  {
    notation:
      "{d12 [Weapon damage], d20 // Alternative\n}kh1 [Keep the higher result]",
    result: group,
  },
  { notation: "d{0:5} + d{1,1,2,3,5,8} + d{10,20}", result: custom },
].map((roll) => ({ ...roll, total: roll.result.value }));

export const sampleResult: SvgHistory = {
  rolls,
  total: rolls.reduce((sum, roll) => sum + roll.total, 0),
};

const singleD20 = pool(
  "20",
  20,
  [die(20, ["explode"]), die(7), die(11)],
  [{ type: "modifier", name: "explode", compound: false, penetrate: false }],
);
const singleResult = binary(
  "+",
  {
    ...singleD20,
    qty: number(2),
    node: { ...singleD20.node, qty: number(2).node },
  },
  pool(
    "8",
    8,
    [die(3, ["drop"], false), die(8), die(5, ["drop"], false)],
    [{ type: "modifier", name: "keep", end: "h", qty: 1 }],
  ),
);

/** A single fixed roll, separate from the history preview. */
export const sampleRoll: SvgRoll = {
  notation: "2d20! + 3d8kh",
  result: singleResult,
  total: singleResult.value,
};
