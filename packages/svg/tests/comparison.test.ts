import assert from "node:assert/strict";
import { test } from "node:test";
import type { ast, ExpressionResult } from "@dice-roller/rpg-dice-roller";
import { SvgPresenter } from "../dist/index.js";
import type { SvgExpressionResult } from "../dist/index.js";
import { decisionExamples } from "./fixtures/decision-examples.js";

const number = (value: number): ExpressionResult => ({
  type: "number",
  node: { type: "number", value },
  value,
});
const comparison = (
  op: ast.CompareOperator,
  value: number,
  left = number(2),
  right = number(3),
): SvgExpressionResult => ({
  type: "comparison",
  node: { op },
  value,
  left,
  right,
});
const presenter = new SvgPresenter({ noWrap: true, showNotation: false });
const texts = (svg: string) =>
  [...svg.matchAll(/class="math"[^>]*>([^<]*)<\/text>/g)].map(
    (match) => match[1]!,
  );

test("all comparison operators show their operands, source operator and numeric truth outcome", () => {
  for (const [op, symbol] of [
    ["=", "="],
    ["!=", "≠"],
    ["<>", "≠"],
    ["<", "&lt;"],
    ["<=", "≤"],
    [">", "&gt;"],
    [">=", "≥"],
  ] as const) {
    for (const value of [0, 1]) {
      const [left, right]: readonly [number, number] =
        op === "="
          ? [2, value ? 2 : 3]
          : op === "!=" || op === "<>"
            ? [2, value ? 3 : 2]
            : op === "<" || op === "<="
              ? value
                ? [2, 3]
                : [3, 2]
              : value
                ? [3, 2]
                : [2, 3];
      const result = comparison(op, value, number(left), number(right));
      const roll = { notation: "comparison", total: value, result };
      for (const target of [result, roll, { rolls: [roll], total: value }]) {
        const svg = presenter.present(target);
        assert.deepEqual(texts(svg), [String(left), symbol, String(right)]);
        assert.ok(
          svg.includes(
            `data-operator="${op.replaceAll("<", "&lt;").replaceAll(">", "&gt;")}"`,
          ),
        );
        assert.match(
          svg,
          new RegExp(`>${value ? "true" : "false"} · ${value}</text>`),
        );
        assert.ok(svg.includes(`data-truth="${Boolean(value)}"`));
      }
    }
  }
});

test("comparison operands retain parentheses and comparison arithmetic is grouped", () => {
  const inner = comparison("<", 1, number(1), number(2));
  const operand = inner as ExpressionResult;
  const sum: ExpressionResult = {
    type: "binary",
    node: {
      type: "binary",
      op: "+",
      left: number(3).node,
      right: number(4).node,
    },
    value: 7,
    left: number(3),
    right: number(4),
  };
  assert.deepEqual(texts(presenter.present(comparison("=", 0, operand, sum))), [
    "(",
    "1",
    "&lt;",
    "2",
    ")",
    "=",
    "3",
    "+",
    "4",
  ]);
  const product: ExpressionResult = {
    type: "binary",
    node: {
      type: "binary",
      op: "*",
      left: operand.node,
      right: number(5).node,
    },
    value: 5,
    left: operand,
    right: number(5),
  };
  assert.deepEqual(texts(presenter.present(product)), [
    "(",
    "1",
    "&lt;",
    "2",
    ")",
    "×",
    "5",
  ]);
});

test("saved core comparisons keep dice, true/false outcomes and totals", () => {
  for (const index of [0, 1, 6, 8]) {
    const roll = decisionExamples[index]!;
    const svg = presenter.present(roll);
    assert.match(svg, /class="comparison-result"/);
    assert.match(svg, /data-die-type=/);
    assert.ok(svg.includes(`Total: ${roll.total}`));
    assert.doesNotMatch(svg, /undefined|NaN/);
  }
});

test("negative, decimal and non-finite operands are rendered from their stored values", () => {
  assert.deepEqual(
    texts(
      presenter.present(comparison("<=", 1, number(-2.5), number(Infinity))),
    ),
    ["-2.5", "≤", "Infinity"],
  );
});
