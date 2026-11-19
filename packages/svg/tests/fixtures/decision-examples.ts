// Matches evaluated snapshots from rpg-dice-roller next at
// bf5497c92098b6b035c978e2e54c89ab342babc0. These fixed results do not roll dice.
// The published beta predates these types, so compatibility casts stay here.
import type { ast } from "@dice-roller/rpg-dice-roller";
import type { SvgExpressionResult, SvgRoll } from "../../src/index.js";

type Result = SvgExpressionResult;
const snapshot = (value: unknown) => value as Result;
const node = (result: Result) => result.node as ast.ExpressionNode;
const number = (value: number): Result => ({
  type: "number",
  node: { type: "number", value },
  value,
});
const reference = (value: number): Result => ({
  type: "condition-reference",
  node: { type: "condition-reference" },
  value,
});
const poolNode = (sides: number, qty = 1) => ({
  type: "pool",
  qty: node(number(qty)),
  die: { type: "die", name: "standard", args: [node(number(sides))] },
  modifiers: [],
});
const pool = (sides: number, values: number[]): Result =>
  snapshot({
    type: "pool",
    node: poolNode(sides, values.length),
    value: values.reduce((sum, value) => sum + value, 0),
    qty: number(values.length),
    dieArgs: [number(sides)],
    die: {
      notation: String(sides),
      min: 1,
      max: sides,
      average: (sides + 1) / 2,
      faceCount: sides,
    },
    rolls: values.map((value) => ({
      type: "die",
      value,
      initialValue: value,
      calculationValue: value,
      useInTotal: true,
      flags: [],
    })),
  });
const paren = (inner: Result): Result =>
  snapshot({
    type: "paren",
    node: { type: "paren", expression: node(inner) },
    value: inner.value,
    inner,
  });
const binary = (op: "+" | "*", left: Result, right: Result): Result =>
  snapshot({
    type: "binary",
    node: { type: "binary", op, left: node(left), right: node(right) },
    value: op === "+" ? left.value + right.value : left.value * right.value,
    left,
    right,
  });
const comparison = (
  op: ast.CompareOperator,
  left: Result,
  right: Result,
  value: 0 | 1,
): Result =>
  snapshot({
    type: "comparison",
    node: { type: "comparison", op, left: node(left), right: node(right) },
    value,
    left,
    right,
  });
const conditional = (
  condition: Result,
  selectedBranch: "true" | "false",
  selectedResult: Result,
  other: unknown,
  shorthand = false,
): Result => ({
  type: "conditional",
  node: {
    type: "conditional",
    condition: node(condition),
    trueBranch: shorthand
      ? null
      : selectedBranch === "true"
        ? node(selectedResult)
        : other,
    falseBranch: selectedBranch === "false" ? node(selectedResult) : other,
  },
  value: selectedResult.value,
  condition,
  selectedBranch,
  selectedResult,
});

const passed = comparison(">=", paren(pool(20, [17])), number(10), 1);
const failed = comparison(">=", paren(pool(20, [3])), number(10), 0);
const reward = binary("+", pool(8, [5, 7]), reference(1));
const dropped = conditional(
  comparison(">", paren(pool(6, [2])), number(3), 0),
  "false",
  pool(4, [1]),
  poolNode(8),
);
const kept = pool(12, [10]);
const group = snapshot({
  type: "group",
  value: 10,
  node: {
    type: "group",
    expressions: [node(dropped), node(kept)],
    modifiers: [{ type: "modifier", name: "keep", end: "h", qty: 1 }],
  },
  members: [dropped, kept].map((result, index) => ({
    type: "group-member",
    result,
    value: result.value,
    calculationValue: result.value,
    flags: index ? [] : ["drop"],
    useInTotal: Boolean(index),
  })),
});
const args = [
  paren(comparison(">", paren(pool(6, [5])), number(3), 1)),
  paren(conditional(number(0), "false", pool(8, [7]), poolNode(20))),
];

export const decisionExamples: readonly SvgRoll[] = [
  {
    notation: "(2d6+4)>10",
    result: comparison(
      ">",
      paren(binary("+", pool(6, [4, 5]), number(4))),
      number(10),
      1,
    ),
  },
  {
    notation: "(2d6+4)>10",
    result: comparison(
      ">",
      paren(binary("+", pool(6, [1, 2]), number(4))),
      number(10),
      0,
    ),
  },
  {
    notation: "((d20)>=10) ? (2d8+$condition) : (d4)",
    result: conditional(passed, "true", reward, poolNode(4)),
  },
  {
    notation: "((d20)>=10) ? (2d8+$condition) : (d4)",
    result: conditional(failed, "false", pool(4, [4]), {
      type: "binary",
      op: "+",
      left: poolNode(8, 2),
      right: { type: "condition-reference" },
    }),
  },
  {
    notation: "(d6) ?: (d8)",
    result: conditional(pool(6, [5]), "true", reference(5), poolNode(8), true),
  },
  {
    notation: "((d20)>=10) ? (((d6)>3) ? ($condition+2) : (d4)) : (0)",
    result: conditional(
      passed,
      "true",
      conditional(
        comparison(">", paren(pool(6, [5])), number(3), 1),
        "true",
        binary("+", reference(1), number(2)),
        poolNode(4),
      ),
      node(number(0)),
    ),
  },
  {
    notation: "((2d6)>(d8+2))*5",
    result: binary(
      "*",
      paren(
        comparison(
          ">",
          paren(pool(6, [2, 4])),
          paren(binary("+", pool(8, [3]), number(2))),
          1,
        ),
      ),
      number(5),
    ),
  },
  { notation: "{((d6)>3) ? (d8) : (d4), d12}kh1", result: group },
  {
    notation: "max(((d6)>3), ((0) ? (d20) : (d8)))",
    result: snapshot({
      type: "function",
      node: { type: "function", name: "max", args: args.map(node) },
      value: 7,
      args,
    }),
  },
].map((roll) => ({ ...roll, total: roll.result.value }));
