import assert from "node:assert/strict";
import { test } from "node:test";
import { Roll, RollHistory, errors } from "@dice-roller/rpg-dice-roller";
import type { ExpressionResult, results } from "@dice-roller/rpg-dice-roller";
import { SvgPresenter } from "../dist/index.js";
import {
  createRollExample,
  createRollExamples,
  createExampleHistory,
  createDeferredExamples,
  deferredExampleDefinitions,
  rollExampleDefinitions,
  singleRollDefinition,
} from "../../../demo/svg/roll-examples.js";

// Exhaustive against the dependency's actual union. Adding/renaming a core result
// type must cause a typecheck failure here until integration coverage is updated.
function* visibleResults(
  result: ExpressionResult,
  excluded = false,
): Generator<{ result: ExpressionResult; excluded: boolean }> {
  yield { result, excluded };
  switch (result.type) {
    case "number":
    case "pool":
      return;
    case "binary":
      yield* visibleResults(result.left, excluded);
      yield* visibleResults(result.right, excluded);
      return;
    case "unary":
      yield* visibleResults(result.operand, excluded);
      return;
    case "paren":
      yield* visibleResults(result.inner, excluded);
      return;
    case "function":
      for (const arg of result.args) yield* visibleResults(arg, excluded);
      return;
    case "group":
      for (const member of result.members)
        yield* visibleResults(member.result, excluded || !member.useInTotal);
      return;
    default: {
      const unhandled: never = result;
      throw new Error(
        `Core result needs integration coverage: ${JSON.stringify(unhandled)}`,
      );
    }
  }
}
function attribute(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\bdata-${name}="([^"]*)"`));
  assert.ok(match, `Missing data-${name}: ${tag}`);
  return match[1]!;
}
function assertMatchesCore(svg: string, roll: Roll<unknown>, totals = true) {
  const actual = [...visibleResults(roll.result)];
  const expectedPools = actual.filter(
    (item): item is { result: results.PoolResult; excluded: boolean } =>
      item.result.type === "pool",
  );
  const pools = [...svg.matchAll(/<g class="dice-pool-result"[^>]*>/g)].map(
    (match) => match[0],
  );
  assert.equal(pools.length, expectedPools.length, roll.notation);
  for (const [index, { result: pool }] of expectedPools.entries()) {
    const rendered = pools[index]!;
    assert.equal(Number(attribute(rendered, "quantity")), pool.qty.value);
    assert.equal(
      Number(attribute(rendered, "result-count")),
      pool.rolls.length,
    );
    assert.equal(
      Number(attribute(rendered, "counted-count")),
      pool.rolls.filter((die) => die.useInTotal).length,
    );
    assert.equal(Number(attribute(rendered, "value")), pool.value);
  }
  const expectedDice = expectedPools.flatMap(({ result: pool, excluded }) =>
    pool.rolls.map((die) => ({
      pool,
      die,
      excluded: excluded || !die.useInTotal,
    })),
  );
  const dice = [...svg.matchAll(/<g[^>]*data-die-type="[^"]*"[^>]*>/g)].map(
    (match) => match[0],
  );
  assert.equal(dice.length, expectedDice.length, roll.notation);
  for (const [index, { pool, die, excluded }] of expectedDice.entries()) {
    const rendered = dice[index]!;
    assert.equal(attribute(rendered, "die-type"), pool.node.die.name);
    assert.equal(Number(attribute(rendered, "faces")), pool.die.faceCount);
    assert.equal(Number(attribute(rendered, "value")), die.value);
    assert.equal(
      Number(attribute(rendered, "initial-value")),
      die.initialValue,
    );
    assert.equal(
      Number(attribute(rendered, "calculation-value")),
      die.calculationValue,
    );
    assert.equal(attribute(rendered, "flags"), die.flags.join(" "));
    assert.equal(attribute(rendered, "use-in-total"), String(die.useInTotal));
    assert.equal(attribute(rendered, "excluded"), String(excluded));
  }
  if (totals) assert.ok(svg.includes(`Total: ${roll.total}</text>`));
  else assert.doesNotMatch(svg, /class="total"/);
}

for (const definition of [...rollExampleDefinitions, singleRollDefinition]) {
  test(`real-core integration: ${definition.id}`, () => {
    const example = createRollExample(definition);
    assert.ok(example.roll instanceof Roll);
    const before = JSON.stringify(example.roll.result);
    const draws = example.randomDrawCount();
    for (const options of [
      { size: 40, width: 500 },
      { size: 140, modifierIconPosition: "below" as const },
      { size: 400, noWrap: true },
      {
        showValues: false,
        showDiceLabels: false,
        showModifierLabels: false,
        showModifierIcons: false,
        showNotation: false,
        showTotals: false,
      },
    ]) {
      const presenter = new SvgPresenter(options);
      const svg = example.roll.present(presenter);
      assertMatchesCore(svg, example.roll, options.showTotals !== false);
      assert.doesNotMatch(svg, /undefined|NaN/);
      assert.equal(
        example.randomDrawCount(),
        draws,
        "Formatting must not draw more random values",
      );
      assert.equal(
        JSON.stringify(example.roll.result),
        before,
        "Formatting must not alter core data",
      );
    }
  });
}

test("seeded examples exercise actual modifier outcomes rather than preassigned flags", () => {
  const expected: Record<string, readonly results.ResultFlag[]> = {
    keep: ["drop"],
    "explode-reroll": ["explode", "re-roll"],
    targets: ["target-success", "target-failure"],
    criticals: ["critical-success", "critical-failure"],
    compound: ["compound"],
    penetrate: ["penetrate"],
    "compound-penetrate": ["compound", "penetrate"],
    unique: ["unique"],
    "unique-once": ["unique-once"],
    "reroll-once": ["re-roll-once"],
    bounds: ["min", "max"],
    "group-targets": ["target-success", "target-failure"],
    "keep-group": ["drop"],
    "drop-group": ["drop"],
    "limits-and-amounts": ["explode", "re-roll-once"],
  };
  for (const { id, roll } of createRollExamples()) {
    const flags = [...visibleResults(roll.result)].flatMap(({ result }) =>
      result.type === "pool"
        ? result.rolls.flatMap((die) => die.flags)
        : result.type === "group"
          ? result.members.flatMap((member) => member.flags)
          : [],
    );
    for (const wanted of expected[id] ?? [])
      assert.ok(flags.includes(wanted), `${id} must produce ${wanted}`);
  }
});

test("fresh examples reproduce their seeds and real histories retain ordering and totals", () => {
  const examples = createRollExamples();
  const repeated = createRollExamples();
  assert.deepEqual(
    examples.map((item) => item.roll.result),
    repeated.map((item) => item.roll.result),
  );
  const history = createExampleHistory(examples);
  assert.ok(history instanceof RollHistory);
  assert.deepEqual(
    history.rolls,
    examples.map((example) => example.roll),
  );
  assert.equal(
    history.total,
    examples.reduce((sum, example) => sum + example.roll.total, 0),
  );
  const draws = examples.map((item) => item.randomDrawCount());
  const svg = history.present(new SvgPresenter());
  assert.equal((svg.match(/class="divider"/g) ?? []).length, examples.length);
  assert.ok(svg.includes(`History total: ${history.total}</text>`));
  assert.deepEqual(
    examples.map((item) => item.randomDrawCount()),
    draws,
  );
});

test("deferred notation is either a genuine core roll or an explicit core rejection", () => {
  const examples = createDeferredExamples();
  assert.equal(examples.length, deferredExampleDefinitions.length);
  for (const item of examples) {
    if (item.status === "available") {
      assert.ok(item.example.roll instanceof Roll);
      // Do not catch presenter errors here: a future core schema change must fail CI.
      item.example.roll.present(new SvgPresenter());
    } else {
      assert.ok(item.reason.length > 0);
      assert.throws(
        () => createRollExample(item.definition),
        (error) =>
          error instanceof errors.DiceRollerError &&
          error.message === item.reason,
      );
    }
  }
});

test("invalid supported examples fail instead of silently substituting a fixture", () => {
  assert.throws(
    () => createRollExample({ id: "invalid", notation: "4de", seed: 1 }),
    errors.NotationError,
  );
});

test("a real export/import round trip is still accepted by the presenter", () => {
  const example = createRollExample(singleRollDefinition);
  const imported = Roll.import(example.roll.export("object"));
  assert.deepEqual(imported.result, example.roll.result);
  assertMatchesCore(imported.present(new SvgPresenter()), imported);
});
