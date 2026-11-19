import assert from "node:assert/strict";
import { test } from "node:test";
import { SvgPresenter } from "../dist/index.js";
import { Roll, RollHistory } from "@dice-roller/rpg-dice-roller";
import { decisionExamples } from "./fixtures/decision-layout-results.js";

const presenter = new SvgPresenter({ noWrap: true, showNotation: false });
const dice = (svg: string) => [
  ...svg.matchAll(/data-die-type="[^"]+"[^>]*data-excluded="(true|false)"/g),
];
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
  const roll = new Roll("(1) ? ($$condition) : (0)");
  const history = new RollHistory();
  history.add(roll);
  for (const target of [roll.result, roll, history]) {
    const svg = presenter.present(target);
    assert.match(svg, /data-selected-branch="true"/);
    assert.match(svg, /class="condition-reference-result" data-value="1"/);
  }
});

test("shorthand and explicit condition references do not repeat the condition dice", () => {
  const svg = presenter.present(decisionExamples[4]!);
  assert.equal(dice(svg).length, 1);
  assert.match(svg, /class="condition-reference-result" data-value="4"/);
  assert.match(svg, /<title>\$\$condition: 4<\/title>/);
  assert.doesNotMatch(svg, /data-faces="8"/);
  const falseBranch = presenter.present(new Roll("(0) ? (1) : ($$condition)"));
  assert.match(falseBranch, />IF · false<\/text>/);
  assert.match(falseBranch, /data-value="0"/);
});

test("nested conditions display their own resolved references and support arithmetic", () => {
  const nested = new Roll("(2) ? ((7) ? ($$condition) : (0)) : (0)");
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
  for (const [value, label] of [
    [-2, "true"],
    [0, "false"],
  ] as const) {
    const svg = presenter.present(new Roll(`(${value}) ? (10) : (10)`));
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
  assert.match(svg, /data-selected-branch="true"[^>]*data-excluded="true"/);
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
  const target = structuredClone({
    notation: decisionExamples[2]!.notation,
    total: decisionExamples[2]!.total,
    result: decisionExamples[2]!.result,
  });
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

test("caller data references retain their notation and resolved value", () => {
  const roll = new Roll("$character.bonus + 1", {
    data: { character: { bonus: 4 } },
  });
  const svg = roll.present(presenter);
  assert.match(svg, /<title>\$character\.bonus: 4<\/title>/);
  assert.match(svg, />\$character\.bonus<\/text>/);
  assert.match(svg, />Total: 5<\/text>/);
});
