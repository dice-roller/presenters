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
