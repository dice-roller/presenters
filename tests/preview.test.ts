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

test("hover regions follow nested groups, members and pools without intercepting their children", () => {
  for (const modifierIconPosition of ["corner", "below"] as const) {
    const svg = new Roll("{{d6 + d8, d10}, d4}kh1").present(
      new SvgPresenter(artwork, {
        ...appearance,
        modifierIconPosition,
        showModifierIcons: false,
        showModifierLabels: false,
      }),
    );
    assert.equal((svg.match(/class="roll-group-result"/g) ?? []).length, 2);
    assert.equal((svg.match(/class="group-member-result"/g) ?? []).length, 4);
    assert.equal((svg.match(/class="dice-pool-result"/g) ?? []).length, 4);
    assert.equal((svg.match(/class="result-hover-outline"/g) ?? []).length, 10);
    assert.equal((svg.match(/class="roll-group-hit-area"/g) ?? []).length, 2);
    assert.match(svg, /data-group="true" data-notation="/);
    assert.match(svg, /<title>Roll group:/);
    assert.match(svg, /<title>Group member:/);
    assert.match(svg, /<title>Dice pool:/);
    for (const outline of svg.matchAll(
      /<rect class="result-hover-outline"[^>]*>/g,
    )) {
      assert.ok(outline[0].includes('pointer-events="none"'));
      const width = Number(outline[0].match(/width="([\d.]+)"/)![1]);
      const height = Number(outline[0].match(/height="([\d.]+)"/)![1]);
      assert.ok(width > 0 && height > 0);
    }
    // Suppression includes nested groups as well as pools and members.
    assert.ok(
      svg.includes(
        ":hover:not(:has(:is(.dice-pool-result,.group-member-result,.roll-group-result):hover))>.result-hover-outline",
      ),
    );
  }
});

test("multi-pool group example exposes outlines at all three levels", () => {
  const svg = new SvgPresenter(artwork, appearance).present(
    sampleResult.rolls[18]!,
  );
  assert.equal((svg.match(/class="roll-group-result"/g) ?? []).length, 1);
  assert.equal((svg.match(/class="group-member-result"/g) ?? []).length, 2);
  assert.equal((svg.match(/class="dice-pool-result"/g) ?? []).length, 4);
  assert.equal((svg.match(/class="result-hover-outline"/g) ?? []).length, 7);
  assert.match(svg, /--result-hover-fill-opacity/);
  assert.match(svg, /--result-hover-stroke-opacity/);
  assert.ok(svg.includes("Total: 9"));
});

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
  assert.equal(sampleResult.total, 347);
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
  assert.ok(small.includes("History total: 347"));
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
  assert.ok(Math.abs(height - totalY - 24) < 0.001);
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
  const offsets = [
    ...svg.matchAll(
      /class="group-member-result"[^>]*transform="translate\(([\d.]+) ([\d.]+)\)"/g,
    ),
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
        (Number(dice[0]![1]) +
          Number(offsets[0]![1]) +
          Number(dice[1]![1]) +
          Number(offsets[1]![1]) +
          appearance.size) /
          2,
    ) < 0.001,
  );
  assert.ok(Number(group[2]) < Number(pool[2]) + Number(offsets[0]![2]));
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
      if (combination === 15)
        assert.equal(
          svg.replace(/dice-\d+-/g, "dice-render-"),
          baseline.replace(/dice-\d+-/g, "dice-render-"),
        );
    }
    assert.equal(JSON.stringify(target), before);
  }
});

test("modifier icons cover the result families and remain independent of labels", () => {
  const before = JSON.stringify(sampleResult);
  const shown = new SvgPresenter(artwork, {
    ...appearance,
    showModifierLabels: false,
  }).present(sampleResult);
  for (const kind of [
    "explode",
    "compound",
    "penetrate",
    "re-roll",
    "unique",
    "min",
    "max",
    "target-success",
    "target-failure",
    "critical-success",
    "critical-failure",
  ])
    assert.ok(shown.includes(`data-modifier="${kind}"`), kind);
  assert.doesNotMatch(shown, /<text[^>]*class="badge"/);
  const hidden = new SvgPresenter(artwork, {
    ...appearance,
    showModifierIcons: false,
  }).present(sampleResult);
  assert.ok(!hidden.includes("data-modifier="));
  assert.ok(!hidden.includes('class="modifier-cutout"'));
  assert.match(hidden, /<text[^>]*class="badge"/);
  assert.ok(hidden.includes('data-flags="explode"'));
  assert.ok(hidden.includes("; explode</title>"));
  assert.equal(JSON.stringify(sampleResult), before);
});

test("corner icons straddle the top edge with circular transparent cutouts; below icons have none", () => {
  for (const size of [40, 80, 140, 200, 400]) {
    for (const modifierIconPosition of ["corner", "below"] as const) {
      const svg = new SvgPresenter(artwork, {
        ...appearance,
        size,
        modifierIconPosition,
      }).present(sampleRoll);
      const die = svg.match(/<svg x="([\d.]+)" y="([\d.]+)" width="/)!;
      const badge = svg.match(
        /data-modifier="explode"[^>]* x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/,
      )!;
      const [x, y, width, height] = badge.slice(1).map(Number) as [
        number,
        number,
        number,
        number,
      ];
      assert.ok(y >= 0);
      if (modifierIconPosition === "corner") {
        assert.ok(Math.abs(x + width / 2 - Number(die[1]) - size) < 0.001);
        assert.ok(Math.abs(y + height / 2 - Number(die[2])) < 0.001);
        assert.match(svg, /class="modifier-cutout"/);
        const circle = svg.match(
          /<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)" fill="black"/,
        )!;
        assert.ok(Math.abs(Number(circle[1]) - 100) < 0.001);
        assert.equal(Number(circle[2]), 0);
        assert.ok(Number(circle[3]) > ((width / 2) * 100) / size);
        assert.match(svg, /class="die-artwork" mask="url\(#dice-/);
      } else {
        assert.ok(y > Number(die[2]) + size);
        assert.doesNotMatch(svg, /class="modifier-cutout"/);
        assert.doesNotMatch(svg, /class="die-artwork" mask=/);
      }
    }
  }
});

test("compound/penetrate uses separate open symbols with a masked amber rear burst", () => {
  const svg = new SvgPresenter(artwork, {
    ...appearance,
    modifierIconPosition: "below",
  }).present(sampleResult.rolls[10]!);
  assert.equal((svg.match(/data-modifier="compound"/g) ?? []).length, 1);
  assert.equal((svg.match(/data-modifier="penetrate"/g) ?? []).length, 1);
  assert.ok(!svg.includes('data-modifier="explode"'));
  assert.match(svg, /class="modifier-overlap-mask"/);
  assert.doesNotMatch(svg, /class="modifier-cutout"/);
  assert.match(svg, /class="modifier-compound-back"/);
  assert.match(svg, /aria-label="Compounding explosion"/);
  assert.match(svg, /aria-label="Penetrating explosion"/);
  assert.ok(!svg.includes('fill="#f3e8ff"'));
});

test("once variants share family icons and do not claim that uniqueness is guaranteed", () => {
  for (const [index, icon, flag] of [
    [12, "unique", "unique-once"],
    [13, "re-roll", "re-roll-once"],
  ] as const) {
    const svg = new SvgPresenter(artwork, appearance).present(
      sampleResult.rolls[index]!,
    );
    assert.equal(
      (svg.match(new RegExp(`data-modifier="${icon}"`, "g")) ?? []).length,
      1,
    );
    assert.ok(svg.includes(`data-flags="${flag}"`));
  }
  const svg = new SvgPresenter(artwork, appearance).present(
    sampleResult.rolls[12]!,
  );
  assert.match(svg, /aria-label="Re-rolled for uniqueness"/);
});

test("group member icons attach to their member rather than every nested die", () => {
  for (const modifierIconPosition of ["corner", "below"] as const) {
    const svg = new SvgPresenter(artwork, {
      ...appearance,
      modifierIconPosition,
    }).present(sampleResult.rolls[15]!);
    assert.equal((svg.match(/data-group-member="true"/g) ?? []).length, 2);
    for (const kind of [
      "target-success",
      "target-failure",
      "critical-success",
      "critical-failure",
    ])
      assert.equal(
        (svg.match(new RegExp(`data-modifier="${kind}"`, "g")) ?? []).length,
        1,
      );
    assert.equal((svg.match(/data-die-type=/g) ?? []).length, 2);
    assert.ok(svg.includes('data-flags=""'));
    assert.ok(svg.includes("Total: 0"));
  }
});

test("group outcome icons end at the dice corner and flow left regardless of labels", () => {
  for (const size of [40, 140, 400]) {
    for (const showModifierLabels of [true, false]) {
      const svg = new SvgPresenter(artwork, {
        ...appearance,
        size,
        showModifierLabels,
        modifierIconPosition: "corner",
      }).present(sampleResult.rolls[15]!);
      const members = svg.split('class="group-member-result"').slice(1);
      assert.equal(members.length, 2);
      for (const member of members) {
        const die = member.match(/<svg x="([\d.]+)" y="[\d.]+" width="/)!;
        const icons = [
          ...member.matchAll(
            /data-modifier="[^"]+"[^>]* x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)"/g,
          ),
        ];
        assert.equal(icons.length, 2);
        const last = icons.at(-1)!;
        const right = Number(die[1]) + size;
        assert.ok(
          Math.abs(Number(last[1]) + Number(last[3]) / 2 - right) < 0.001,
        );
        assert.ok(
          Number(icons[0]![1]) + Number(icons[0]![3]) <= Number(last[1]),
        );
        const circles = [
          ...member.matchAll(
            /<circle cx="(-?[\d.]+)" cy="(-?[\d.]+)" r="[\d.]+" fill="black"/g,
          ),
        ];
        assert.ok(Math.abs(Number(circles.at(-1)![1]) - right) < 0.001);
      }
    }
  }
});

test("group modifier labels are smaller centred captions without horizontal label space", () => {
  for (const size of [40, 140]) {
    for (const modifierIconPosition of ["corner", "below"] as const) {
      const presenter = (showModifierLabels: boolean) =>
        new SvgPresenter(artwork, {
          ...appearance,
          size,
          modifierIconPosition,
          showModifierLabels,
        }).present(sampleResult.rolls[15]!);
      const shown = presenter(true);
      const hidden = presenter(false);
      const mathPositions = (svg: string) =>
        [...svg.matchAll(/<text x="([\d.]+)"[^>]*class="math"/g)].map(
          (match) => match[1],
        );
      assert.deepEqual(mathPositions(shown), mathPositions(hidden));
      assert.doesNotMatch(hidden, /class="group-member-label/);
      for (const member of shown
        .split('class="group-member-result"')
        .slice(1)) {
        const maths = [
          ...member.matchAll(
            /<text x="([\d.]+)"[^>]*class="math"[^>]*font-size="([\d.]+)"/g,
          ),
        ];
        const expectedCentre =
          (Number(maths[0]![1]) + Number(maths[1]![1])) / 2;
        const captions = [
          ...member.matchAll(
            /<text x="([\d.]+)" y="([\d.]+)" class="group-member-label[^>]*font-size="([\d.]+)"/g,
          ),
        ];
        assert.ok(captions.length > 0);
        const die = member.match(/<svg x="[\d.]+" y="([\d.]+)" width="/)!;
        for (const caption of captions) {
          assert.ok(Math.abs(Number(caption[1]) - expectedCentre) < 0.001);
          assert.ok(Number(caption[2]) > Number(die[1]) + size);
          assert.ok(Number(caption[3]) < Number(maths[0]![2]));
        }
        if (size === 40) assert.ok(captions.length > 1);
      }
    }
  }
});

test("keep and drop group examples exclude complete multi-dice members", () => {
  for (const [index, notation] of [
    [16, "{2d6, 2d8}kh1"],
    [17, "{2d6, 2d8}dl1"],
  ] as const) {
    const roll = sampleResult.rolls[index]!;
    assert.equal(roll.notation, notation);
    assert.equal(roll.total, 11);
    const svg = new SvgPresenter(artwork, appearance).present(roll);
    assert.equal((svg.match(/data-group-member="true"/g) ?? []).length, 2);
    assert.equal(
      (svg.match(/data-excluded="true" data-flags=""/g) ?? []).length,
      2,
    );
    assert.equal(
      (svg.match(/class="group-member-label badge excluded"/g) ?? []).length,
      1,
    );
    assert.doesNotMatch(svg, />\(drop\)<\/text>/);
    assert.ok(svg.includes("Total: 11"));
  }
});

test("group member blank spaces have a transparent hit area behind dice and icons", () => {
  for (const modifierIconPosition of ["corner", "below"] as const) {
    for (const size of [40, 140]) {
      const svg = new SvgPresenter(artwork, {
        ...appearance,
        size,
        modifierIconPosition,
      }).present(sampleResult.rolls[15]!);
      for (const member of svg.split('class="group-member-result"').slice(1)) {
        const hit = member.match(
          /<rect class="group-member-hit-area" x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="transparent" stroke="none" pointer-events="all"\/>/,
        )!;
        assert.ok(hit);
        assert.ok(
          member.indexOf("<title>Group member:") < member.indexOf(hit[0]),
        );
        assert.ok(
          member.indexOf(hit[0]) <
            member.indexOf('class="group-member-artwork"'),
        );
        assert.ok(member.includes("<title>d6:"));
        assert.ok(member.includes('aria-label="Critical'));
        const right = Number(hit[1]) + Number(hit[3]);
        const bottom = Number(hit[2]) + Number(hit[4]);
        for (const icon of member.matchAll(
          /data-modifier="[^"]+"[^>]* x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/g,
        )) {
          assert.ok(Number(icon[1]) >= Number(hit[1]));
          assert.ok(Number(icon[2]) >= Number(hit[2]));
          assert.ok(Number(icon[1]) + Number(icon[3]) <= right);
          assert.ok(Number(icon[2]) + Number(icon[4]) <= bottom);
        }
        for (const caption of member.matchAll(
          /<text x="[\d.]+" y="([\d.]+)" class="group-member-label/g,
        ))
          assert.ok(Number(caption[1]) <= bottom);
      }
    }
  }
});

test("every group member has its own title and hit area regardless of modifier visibility", () => {
  for (const modifierIconPosition of ["corner", "below"] as const) {
    for (const showModifierLabels of [true, false]) {
      for (const showModifierIcons of [true, false]) {
        const presenter = new SvgPresenter(artwork, {
          ...appearance,
          modifierIconPosition,
          showModifierLabels,
          showModifierIcons,
        });
        for (const [target, expected] of [
          [sampleResult.rolls[6]!, 2],
          [new Roll("{d6, 2 + 3}").result, 2],
          [new Roll("{{d6, d8}, 2d10}").result, 4],
        ] as const) {
          const svg = presenter.present(target);
          const members = svg.split('class="group-member-result"').slice(1);
          assert.equal(members.length, expected);
          for (const member of members) {
            assert.match(member, /^[^>]*><title>Group member:/);
            assert.match(member, /<rect class="group-member-hit-area"/);
          }
        }
      }
    }
  }
});

test("mask identifiers are unique across outputs and all references resolve", () => {
  const presenter = new SvgPresenter(artwork, appearance);
  const svg = presenter.present(sampleResult) + presenter.present(sampleResult);
  const identifiers = [...svg.matchAll(/\bid="([^"]+)"/g)].map(
    (match) => match[1]!,
  );
  assert.equal(new Set(identifiers).size, identifiers.length);
  for (const reference of svg.matchAll(/url\(#([^)]+)\)/g))
    assert.ok(identifiers.includes(reference[1]!));
});

test("many modifiers wrap safely on small dice and location changes preserve all results", () => {
  const base = sampleResult.rolls[8]!;
  assert.equal(base.result.type, "pool");
  if (base.result.type !== "pool") return;
  const roll = {
    ...base,
    result: {
      ...base.result,
      rolls: [
        {
          ...base.result.rolls[0]!,
          flags: [
            "explode",
            "compound",
            "penetrate",
            "re-roll",
            "unique",
            "min",
            "max",
            "target-success",
            "critical-success",
          ] as const,
        },
      ],
    },
  };
  const before = JSON.stringify(roll);
  for (const size of [20, 40, 140, 400]) {
    for (const modifierIconPosition of ["corner", "below"] as const) {
      const svg = new SvgPresenter(artwork, {
        ...appearance,
        size,
        modifierIconPosition,
      }).present(roll);
      const die = svg.match(/<svg x="([\d.]+)" y="([\d.]+)" width="/)!;
      const badges = [
        ...svg.matchAll(
          /data-modifier="[^"]+"[^>]* x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g,
        ),
      ];
      assert.equal(badges.length, 8);
      for (const badge of badges) {
        const [x, y, width, height] = badge.slice(1).map(Number) as [
          number,
          number,
          number,
          number,
        ];
        assert.ok(x >= 0 && x + width <= 1040);
        assert.ok(y >= 0);
        assert.ok(
          modifierIconPosition === "corner"
            ? y + height / 2 <= Number(die[2]) + 0.001
            : y >= Number(die[2]) + size,
        );
      }
      if (size <= 40)
        assert.ok(new Set(badges.map((match) => match[2])).size > 1);
      assert.ok(svg.includes(`Total: ${roll.total}`));
    }
  }
  assert.equal(JSON.stringify(roll), before);
});

test("hiding icons removes layout and masks regardless of position; invalid positions are rejected", () => {
  const presenter = (modifierIconPosition: "corner" | "below") =>
    new SvgPresenter(artwork, {
      ...appearance,
      modifierIconPosition,
      showModifierIcons: false,
    });
  assert.equal(
    presenter("corner").present(sampleRoll),
    presenter("below").present(sampleRoll),
  );
  assert.throws(
    () =>
      new SvgPresenter(artwork, {
        modifierIconPosition: "invalid" as "corner",
      }).present(sampleRoll),
    /Invalid modifier icon position/,
  );
});

test("pool wrappers expose initial quantity, resulting dice and pool totals", () => {
  const before = JSON.stringify(sampleRoll);
  const svg = new SvgPresenter(artwork, appearance).present(sampleRoll);
  const pools = svg.split('class="dice-pool-result"').slice(1);
  assert.equal(pools.length, 2);
  assert.match(
    pools[0]!,
    /data-pool="true" data-notation="2d20!" data-quantity="2" data-result-count="3" data-counted-count="3" data-value="38"/,
  );
  assert.match(
    pools[0]!,
    /<title>Dice pool: 2d20!; 3 results; 3 counted; total 38<\/title>/,
  );
  assert.match(
    pools[1]!,
    /data-notation="3d8kh1" data-quantity="3" data-result-count="3" data-counted-count="1" data-value="8"/,
  );
  assert.equal(JSON.stringify(sampleRoll), before);
});

test("pool hover areas sit behind dice and cover parentheses and descriptions", () => {
  for (const size of [40, 140, 400]) {
    const svg = new Roll("2d6 [Example]").present(
      new SvgPresenter(artwork, { ...appearance, size }),
    );
    const pool = svg.split('class="dice-pool-result"')[1]!;
    const hit = pool.match(
      /<rect class="dice-pool-hit-area" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="transparent" stroke="none" pointer-events="all"\/>/,
    )!;
    assert.ok(hit);
    assert.ok(pool.indexOf(hit[0]) < pool.indexOf('class="math"'));
    assert.ok(pool.indexOf(hit[0]) < pool.indexOf('class="description"'));
    assert.ok(pool.includes("<title>d6:"));
    const [x, y, width, height] = hit.slice(1).map(Number) as [
      number,
      number,
      number,
      number,
    ];
    for (const math of pool.matchAll(
      /<text x="([\d.]+)" y="([\d.]+)" class="math"/g,
    )) {
      assert.ok(Number(math[1]) >= x && Number(math[1]) <= x + width);
      assert.ok(Number(math[2]) >= y && Number(math[2]) <= y + height);
    }
    for (const heading of pool.matchAll(/<tspan x="([\d.]+)" y="([\d.]+)"/g)) {
      assert.ok(Number(heading[1]) >= x && Number(heading[1]) <= x + width);
      assert.ok(Number(heading[2]) >= y && Number(heading[2]) <= y + height);
    }
  }
});

test("group exclusion and hidden labels preserve pool metadata and its own value", () => {
  for (const modifierIconPosition of ["corner", "below"] as const) {
    const svg = new SvgPresenter(artwork, {
      ...appearance,
      modifierIconPosition,
      showValues: false,
      showDiceLabels: false,
      showModifierLabels: false,
      showModifierIcons: false,
      showDescriptions: false,
      showNotation: false,
      showTotals: false,
    }).present(sampleResult.rolls[6]!);
    assert.equal((svg.match(/data-group-member="true"/g) ?? []).length, 2);
    assert.equal((svg.match(/data-pool="true"/g) ?? []).length, 2);
    assert.equal((svg.match(/class="dice-pool-hit-area"/g) ?? []).length, 2);
    assert.match(svg, /Group member: 7; contribution 0; drop/);
    assert.match(
      svg,
      /Dice pool: d20; 1 result; 1 counted; total 7; excluded by enclosing group/,
    );
    assert.match(
      svg,
      /data-notation="d20" data-quantity="1" data-result-count="1" data-counted-count="1" data-value="7"/,
    );
  }
});
