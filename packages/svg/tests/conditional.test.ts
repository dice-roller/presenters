import assert from "node:assert/strict";
import { test } from "node:test";
import { SvgPresenter } from "../dist/index.js";
import type { SvgExpressionResult } from "../dist/index.js";
import { decisionExamples } from "./fixtures/decision-examples.js";

const presenter = new SvgPresenter({ noWrap: true, showNotation: false });
const dice = (svg: string) => [
  ...svg.matchAll(/data-die-type="[^"]+"[^>]*data-excluded="(true|false)"/g),
];
const number = (value: number): SvgExpressionResult => ({
  type: "number",
  node: { type: "number", value },
  value,
});
const reference = (value: number): SvgExpressionResult => ({
  type: "condition-reference",
  node: { type: "condition-reference" },
  value,
});
const conditional = (
  value: number,
  selectedBranch: "true" | "false",
  selectedResult: SvgExpressionResult,
): SvgExpressionResult => ({
  type: "conditional",
  node: {},
  condition: number(value),
  selectedBranch,
  selectedResult,
  value: selectedResult.value,
});

test("ternaries show an IF card leading to only the chosen THEN or ELSE branch", () => {
  for (const [index, branch, count, heading] of [
    [2, "true", 3, "THEN"],
    [3, "false", 2, "ELSE"],
  ] as const) {
    const roll = decisionExamples[index]!;
    const svg = presenter.present(roll);
    assert.match(svg, /class="conditional-result"/);
    assert.ok(svg.includes(`data-selected-branch="${branch}"`));
    assert.match(svg, new RegExp(`>IF · ${branch}</text>`));
    assert.match(svg, new RegExp(`>${heading}</text>`));
    assert.equal(dice(svg).length, count);
    assert.match(svg, /branch not evaluated/);
    assert.ok(svg.includes(`Total: ${roll.total}`));
    assert.doesNotMatch(svg, /check:|undefined|NaN/);
    if (branch === "true") assert.doesNotMatch(svg, /data-faces="4"/);
    else assert.doesNotMatch(svg, /data-faces="8"/);
  }
});

test("conditional results work directly, in rolls and histories", () => {
  const result = conditional(1, "true", reference(1));
  const roll = { notation: "conditional", total: 1, result };
  for (const target of [result, roll, { rolls: [roll], total: 1 }]) {
    const svg = presenter.present(target);
    assert.match(svg, /data-selected-branch="true"/);
    assert.match(svg, /class="condition-reference-result" data-value="1"/);
  }
});

test("shorthand and explicit condition references do not repeat the condition dice", () => {
  const svg = presenter.present(decisionExamples[4]!);
  assert.equal(dice(svg).length, 1);
  assert.match(svg, /class="condition-reference-result" data-value="5"/);
  assert.match(svg, /\$condition: 5/);
  assert.doesNotMatch(svg, /data-faces="8"/);
  const falseBranch = presenter.present(conditional(0, "false", reference(0)));
  assert.match(falseBranch, />IF · false<\/text>/);
  assert.match(falseBranch, /data-value="0"/);
});

test("nested conditions display their own resolved references and support arithmetic", () => {
  const nested = conditional(2, "true", conditional(7, "true", reference(7)));
  const svg = presenter.present(nested);
  assert.equal((svg.match(/class="conditional-result"/g) ?? []).length, 2);
  assert.match(svg, /class="condition-reference-result" data-value="7"/);
  assert.match(svg, /data-condition-value="2"/);
  assert.match(svg, /data-condition-value="7"/);
  const real = presenter.present(decisionExamples[5]!);
  assert.equal(dice(real).length, 2);
  assert.match(real, /class="condition-reference-result" data-value="1"/);
  assert.match(real, />\+<\/text>/);
});

test("negative conditions are truthy and zero conditions are false", () => {
  for (const [value, branch, label] of [
    [-2, "true", "true"],
    [0, "false", "false"],
  ] as const) {
    const svg = presenter.present(conditional(value, branch, number(10)));
    assert.match(svg, new RegExp(`>IF · ${label}</text>`));
    assert.ok(svg.includes(`data-condition-value="${value}"`));
  }
});

test("dropped group members exclude dice in the condition and chosen branch", () => {
  const svg = presenter.present(decisionExamples[7]!);
  const renderedDice = dice(svg);
  assert.equal(renderedDice.length, 3);
  assert.deepEqual(
    renderedDice.map((die) => die[1]),
    ["true", "true", "false"],
  );
  assert.match(svg, /data-selected-branch="false"[^>]*data-excluded="true"/);
});

test("narrow ternaries stack cards while noWrap retains the horizontal flow", () => {
  const roll = decisionExamples[2]!;
  const narrow = new SvgPresenter({
    size: 80,
    width: 360,
    showNotation: false,
  }).present(roll);
  const wide = new SvgPresenter({
    size: 80,
    width: 360,
    noWrap: true,
    showNotation: false,
  }).present(roll);
  assert.match(narrow, /data-layout="vertical"/);
  assert.match(wide, /data-layout="horizontal"/);
  for (const svg of [narrow, wide]) {
    assert.equal(dice(svg).length, 3);
    assert.doesNotMatch(svg, /Infinity|NaN|undefined/);
  }
});

test("presentation never mutates snapshots, evaluates skipped branches or removes decision labels", () => {
  const before = JSON.stringify(decisionExamples);
  const freeze = (value: unknown): void => {
    if (value && typeof value === "object") {
      Object.freeze(value);
      for (const child of Object.values(value)) freeze(child);
    }
  };
  const target = structuredClone(decisionExamples[2]!);
  freeze(target);
  const svg = new SvgPresenter({
    showValues: false,
    showDescriptions: false,
    showNotation: false,
    showTotals: false,
    showDiceLabels: false,
    showModifierLabels: false,
    showModifierIcons: false,
  }).present(target);
  assert.match(svg, />IF · true<\/text>/);
  assert.match(svg, />THEN<\/text>/);
  assert.match(svg, />true · 1<\/text>/);
  assert.doesNotMatch(svg, /class="total"|class="notation"/);
  assert.equal(JSON.stringify(decisionExamples), before);
});
