import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Roll, RollHistory } from "@dice-roller/rpg-dice-roller";
import type { Presenter } from "@dice-roller/rpg-dice-roller";
import { renderSvg, SvgPresenter } from "../dist/svg/index.js";
import { sampleResult, sampleRoll } from "../demo/presenter/sample-result.js";

const artwork = Object.fromEntries(
  ["d2", "d4", "d6", "d8", "d10", "d12", "d20", "generic"].map((name) => [
    name,
    readFileSync(
      new URL(`../assets/dice/${name}.svg`, import.meta.url),
      "utf8",
    ),
  ]),
);
const appearance = {
  size: 140,
  stroke: "#7962b5",
  fill: "#eee7fb",
  filled: false,
  showValues: true,
};

test("SvgPresenter plugs into real v6 rolls and histories without rolling again", () => {
  let calls = 0;
  const roll = new Roll("2d6", {
    engine: {
      next() {
        calls++;
        return 0;
      },
    },
  });
  const before = calls;
  const presenter: Presenter<string> = new SvgPresenter(artwork, appearance);
  assert.ok(roll.present(presenter).includes(`Total: ${roll.total}`));
  const history = new RollHistory();
  history.add(roll, new Roll("3+4"));
  assert.ok(
    history.present(presenter).includes(`History total: ${history.total}`),
  );
  assert.ok(presenter.present(roll.result).includes("Expression"));
  assert.equal(calls, before);
});

test("fixed result preview renders dice, maths and modifier outcomes without changing data", () => {
  const before = JSON.stringify(sampleResult);
  const svg = renderSvg(sampleResult, artwork, appearance);
  assert.equal(sampleResult.total, 254);
  for (const total of [149, 13, 16, 15, 2, 21, 10, 28])
    assert.ok(svg.includes(`Total: ${total}`));
  for (const value of [
    "d%",
    "dF",
    "d13",
    "d{10,20}",
    "floor(",
    "×",
    "÷",
    "score +2",
    "score -1",
    "CS",
    "CF",
    "re-roll",
    "explode",
    'class="excluded"',
  ])
    assert.ok(svg.includes(value), value);
  assert.ok(svg.includes("initial value 1"));
  assert.equal(JSON.stringify(sampleResult), before);
});

test("preview uses the selected appearance, retains totals when values are hidden", () => {
  const small = renderSvg(sampleResult, artwork, {
    ...appearance,
    size: 40,
    filled: true,
    showValues: false,
  });
  const large = renderSvg(sampleResult, artwork, {
    ...appearance,
    size: 400,
  });
  assert.ok(small.includes('width="40" height="40"'));
  assert.ok(large.includes('width="400" height="400"'));
  assert.ok(small.includes("fill:#eee7fb"));
  assert.ok(small.includes("History total: 254"));
  assert.ok(!/data-slot="value"[^>]*>[^<]+<\/text>/.test(small));
});

test("SVG text is escaped and unsafe appearance values are rejected", () => {
  const unsafe = {
    ...sampleResult,
    rolls: [
      { ...sampleResult.rolls[0]!, notation: '<script>alert("x")</script>' },
    ],
  };
  const svg = renderSvg(unsafe, artwork, appearance);
  assert.ok(!svg.includes("<script>"));
  assert.ok(svg.includes("&lt;script&gt;"));
  assert.throws(() =>
    renderSvg(sampleResult, artwork, {
      ...appearance,
      stroke: "red;}</style><script>",
    }),
  );
});

test("pools use parentheses and addition with balanced spacing at every demo size", () => {
  const roll = new Roll("2d6");
  for (const size of [40, 80, 140, 200, 400]) {
    const svg = roll.present(
      new SvgPresenter(artwork, { ...appearance, size }),
    );
    const centres = [...svg.matchAll(/<svg x="([\d.]+)"[^>]*width="/g)].map(
      (match) => Number(match[1]) + size / 2,
    );
    const math = [
      ...svg.matchAll(
        /<text x="([\d.]+)"[^>]*class="math"[^>]*>(.*?)<\/text>/g,
      ),
    ];
    assert.deepEqual(
      math.map((match) => match[2]),
      ["(", "+", ")"],
    );
    const position = (value: string) =>
      Number(math.find((match) => match[2] === value)![1]);
    assert.equal(centres.length, 2);
    const [first, second] = centres as [number, number];
    assert.ok(
      Math.abs(first - position("(") - (position(")") - second)) < 0.001,
      `parentheses at size ${size}`,
    );
    assert.ok(
      Math.abs(position("+") - (first + second) / 2) < 0.001,
      `addition at size ${size}`,
    );
  }
});

test("example eight displays a custom two-faced die as a coin", () => {
  const example = sampleResult.rolls[7]!;
  const svg = renderSvg(
    { rolls: [example], total: example.total },
    artwork,
    appearance,
  );
  assert.match(svg, /d\{10,20\}/);
  assert.match(svg, /<circle class="die-outline"/);
  assert.match(svg, /data-slot="value"[^>]*>20<\/text>/);
  assert.equal(example.total, 28);
});

test("single rolls omit history numbering and totals, even when a history has one roll", () => {
  const presenter = new SvgPresenter(artwork, appearance);
  for (const roll of [sampleRoll, new Roll("2d20! + 3d8kh1")]) {
    const svg = presenter.present(roll);
    assert.ok(svg.includes(`class="notation">${roll.notation}</text>`));
    assert.ok(svg.includes(`Total: ${roll.total}`));
    assert.ok(!svg.includes("History total:"));
    const history = presenter.present({ rolls: [roll], total: roll.total });
    assert.ok(history.includes(`class="notation">1. ${roll.notation}</text>`));
    assert.ok(history.includes(`History total: ${roll.total}`));
  }
});

test("nested descriptions belong to their group or pool and can be hidden", () => {
  const roll = new Roll(
    "{d6 [First <choice>], d8 [Second]}kh1 [Outer\nSecond line] + d4 // Inline label",
  );
  const before = JSON.stringify(roll.result);
  const shown = roll.present(new SvgPresenter(artwork, appearance));
  const hidden = roll.present(
    new SvgPresenter(artwork, { ...appearance, showDescriptions: false }),
  );
  for (const text of [
    "First &lt;choice&gt;",
    "Second",
    "Outer",
    "Second line",
    "Inline label",
  ])
    assert.ok(shown.includes(`>${text}</tspan>`), text);
  assert.ok(!shown.includes("<choice>"));
  assert.ok(!hidden.includes('class="description"'));
  assert.ok(shown.includes(`Total: ${roll.total}`));
  assert.ok(hidden.includes(`Total: ${roll.total}`));
  assert.equal(JSON.stringify(roll.result), before);
});

test("long descriptions wrap rather than shrinking dice or overlapping the total", () => {
  const roll = new Roll(`d6 [${"A long description ".repeat(30)}]`);
  for (const size of [40, 140, 400]) {
    const shown = roll.present(
      new SvgPresenter(artwork, { ...appearance, size }),
    );
    const hidden = roll.present(
      new SvgPresenter(artwork, {
        ...appearance,
        size,
        showDescriptions: false,
      }),
    );
    const height = (svg: string) => Number(svg.match(/height="([\d.]+)"/)![1]);
    assert.ok(height(shown) > height(hidden));
    assert.ok(shown.includes(`width="${size}" height="${size}"`));
    assert.ok((shown.match(/<tspan /g) ?? []).length > 1);
  }
});

test("a text-only continuation row leaves space before the total", () => {
  const svg = new SvgPresenter(artwork, { ...appearance, size: 400 }).present(
    sampleResult.rolls[6]!,
  );
  const math = [
    ...svg.matchAll(
      /<text x="[\d.]+" y="([\d.]+)" class="math"[^>]*font-size="([\d.]+)"/g,
    ),
  ];
  const bottom = Math.max(
    ...math.map((match) => Number(match[1]) + Number(match[2]) / 2),
  );
  const totalBaseline = Number(
    svg.match(/<text x="[\d.]+" y="([\d.]+)" class="total"/)![1],
  );
  assert.ok(totalBaseline - 20 >= bottom + 8);
});

test("single rolls end after their total, without a history divider or spacer", () => {
  const presenter = new SvgPresenter(artwork, appearance);
  const svg = presenter.present(sampleRoll);
  assert.doesNotMatch(svg, /<path[^>]*class="divider"/);
  const height = Number(svg.match(/height="([\d.]+)"/)![1]);
  const totalY = Number(
    svg.match(/<text x="[\d.]+" y="([\d.]+)" class="total"/)![1],
  );
  assert.equal(height - totalY, 24);
  assert.match(presenter.present(sampleResult), /<path[^>]*class="divider"/);
});

test("block descriptions are centred over their own dice, even when wider than the pool", () => {
  for (const size of [40, 140, 400]) {
    const roll = new Roll("d12 [Weapon damage] + d20 [Alternative]");
    const svg = roll.present(
      new SvgPresenter(artwork, { ...appearance, size }),
    );
    const dice = [...svg.matchAll(/<svg x="([\d.]+)" y="([\d.]+)" width="/g)];
    const headings = [
      ...svg.matchAll(
        /<text class="description"[^>]*text-anchor="middle"><tspan x="([\d.]+)" y="([\d.]+)">/g,
      ),
    ];
    assert.equal(headings.length, 2);
    for (let i = 0; i < 2; i++) {
      assert.ok(
        Math.abs(Number(headings[i]![1]) - (Number(dice[i]![1]) + size / 2)) <
          0.001,
      );
      assert.ok(Number(headings[i]![2]) < Number(dice[i]![2]));
    }
  }
});

test("nested group and pool descriptions each use the centre of their own scope", () => {
  const roll = new Roll("{d12 [Weapon damage], d20} [Whole group]");
  const svg = roll.present(new SvgPresenter(artwork, appearance));
  const dice = [...svg.matchAll(/<svg x="([\d.]+)" y="([\d.]+)" width="/g)];
  const headings = [
    ...svg.matchAll(/<tspan x="([\d.]+)" y="([\d.]+)">([^<]+)<\/tspan>/g),
  ];
  const pool = headings.find((match) => match[3] === "Weapon damage")!;
  const group = headings.find((match) => match[3] === "Whole group")!;
  assert.ok(
    Math.abs(Number(pool[1]) - (Number(dice[0]![1]) + appearance.size / 2)) <
      0.001,
  );
  assert.ok(
    Math.abs(
      Number(group[1]) -
        (Number(dice[0]![1]) + Number(dice[1]![1]) + appearance.size) / 2,
    ) < 0.001,
  );
  assert.ok(Number(group[2]) < Number(pool[2]));
});

test("group headings span the complete group including inline labels and drop badges", () => {
  for (const size of [40, 140]) {
    const svg = new SvgPresenter(artwork, { ...appearance, size }).present(
      sampleResult.rolls[6]!,
    );
    const heading = svg.match(
      /<tspan x="([\d.]+)"[^>]*>Keep the higher result<\/tspan>/,
    )!;
    const math = [
      ...svg.matchAll(
        /<text x="([\d.]+)"[^>]*class="math"[^>]*>([^<]+)<\/text>/g,
      ),
    ];
    const opening = Number(math.find((match) => match[2] === "{")![1]);
    const closing = Number(math.find((match) => match[2] === "}")![1]);
    assert.ok(Math.abs(Number(heading[1]) - (opening + closing) / 2) < 0.001);
    const dice = [...svg.matchAll(/<svg x="([\d.]+)"[^>]*width="/g)];
    const poolHeading = svg.match(
      /<tspan x="([\d.]+)"[^>]*>Weapon damage<\/tspan>/,
    )!;
    assert.ok(
      Math.abs(Number(poolHeading[1]) - (Number(dice[0]![1]) + size / 2)) <
        0.001,
    );
  }
});

test("dice expose semantic types, face counts and their actual artwork independently", () => {
  const svg = new Roll("d20 + d% + dF + d13").present(
    new SvgPresenter(artwork, appearance),
  );
  for (const attributes of [
    'data-die-type="standard" data-faces="20" data-notation="d20" data-shape="d20"',
    'data-die-type="percentile" data-faces="100" data-notation="d%" data-shape="d10"',
    'data-die-type="fudge" data-faces="3" data-notation="dF" data-shape="d6"',
    'data-die-type="standard" data-faces="13" data-notation="d13" data-shape="generic"',
  ])
    assert.ok(svg.includes(attributes), attributes);
  const custom = new SvgPresenter(artwork, appearance).present(
    sampleResult.rolls[7]!,
  );
  assert.ok(
    custom.includes(
      'data-die-type="face" data-faces="2" data-notation="d{10,20}" data-shape="d2"',
    ),
  );
});

test("metadata keeps numeric values, flags and effective exclusion when visible values are hidden", () => {
  const svg = new SvgPresenter(artwork, {
    ...appearance,
    showValues: false,
  }).present(sampleResult);
  const dice = [
    ...svg.matchAll(/<g class="(?:included|excluded)"( data-die-type=[^>]+)>/g),
  ].map((match) => match[1]!);
  assert.ok(
    dice.some(
      (data) =>
        data.includes('data-value="6"') &&
        data.includes('data-flags="explode"'),
    ),
  );
  assert.ok(
    dice.some(
      (data) =>
        data.includes('data-value="5"') &&
        data.includes('data-initial-value="1"') &&
        data.includes('data-flags="re-roll"'),
    ),
  );
  assert.ok(
    dice.some(
      (data) =>
        data.includes('data-use-in-total="true"') &&
        data.includes('data-excluded="true"'),
    ),
  );
  assert.ok(
    dice.some(
      (data) =>
        data.includes('data-calculation-value="-1"') &&
        data.includes('data-flags="target-failure"'),
    ),
  );
});

test("custom die names and notation are escaped in metadata attributes", () => {
  const result = new Roll("d6").result;
  assert.equal(result.type, "pool");
  if (result.type !== "pool") return;
  const unsafe = 'custom" onload="alert(1)<&';
  const svg = new SvgPresenter(artwork, appearance).present({
    notation: "Custom die",
    total: result.value,
    result: {
      ...result,
      node: { ...result.node, die: { ...result.node.die, name: unsafe } },
      die: { ...result.die, notation: unsafe },
    },
  });
  assert.ok(!svg.includes(' onload="'));
  assert.ok(
    svg.includes('data-die-type="custom&quot; onload=&quot;alert(1)&lt;&amp;"'),
  );
});

test("label, notation and total visibility options work independently for rolls and histories", () => {
  for (const target of [sampleRoll, sampleResult]) {
    const before = JSON.stringify(target);
    const baseline = new SvgPresenter(artwork, appearance).present(target);
    for (let combination = 0; combination < 16; combination++) {
      const options = {
        showDiceLabels: Boolean(combination & 1),
        showModifierLabels: Boolean(combination & 2),
        showNotation: Boolean(combination & 4),
        showTotals: Boolean(combination & 8),
      };
      const svg = new SvgPresenter(artwork, {
        ...appearance,
        ...options,
      }).present(target);
      assert.equal(
        /<text[^>]*class="caption"/.test(svg),
        options.showDiceLabels,
      );
      assert.equal(
        /<text[^>]*class="badge"/.test(svg),
        options.showModifierLabels,
      );
      assert.equal(
        /<text[^>]*class="notation"/.test(svg),
        options.showNotation,
      );
      assert.equal(/<text[^>]*class="total"/.test(svg), options.showTotals);
      assert.equal(
        svg.includes("History total:"),
        "rolls" in target && options.showTotals,
      );
      assert.equal(
        (svg.match(/data-die-type=/g) ?? []).length,
        (baseline.match(/data-die-type=/g) ?? []).length,
      );
      assert.ok(svg.includes('data-flags="explode"'));
      assert.ok(svg.includes("; explode</title>"));
      if (!options.showModifierLabels)
        assert.doesNotMatch(svg, /class="math"[^>]*>\(drop\)<\/text>/);
      if (combination === 0)
        assert.ok(
          Number(svg.match(/height="([\d.]+)"/)![1]) <
            Number(baseline.match(/height="([\d.]+)"/)![1]),
        );
      if (combination === 15) assert.equal(svg, baseline);
    }
    assert.equal(JSON.stringify(target), before);
  }
});
