import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Roll } from "@dice-roller/rpg-dice-roller";
import { defaultArtwork, SvgPresenter } from "../dist/index.js";

const notation = "d2 + d4 + d6 + d8 + d10 + d12 + d20 + d% + 3dF + d13";

test("bundled artwork matches every exported raw SVG asset", () => {
  assert.deepEqual(Object.keys(defaultArtwork).sort(), [
    "d10",
    "d12",
    "d2",
    "d20",
    "d4",
    "d6",
    "d8",
    "generic",
  ]);
  for (const [key, svg] of Object.entries(defaultArtwork)) {
    assert.equal(
      svg,
      readFileSync(
        new URL(`../assets/dice/${key}.svg`, import.meta.url),
        "utf8",
      ),
    );
  }
  assert.ok(Object.isFrozen(defaultArtwork));
});

test("zero-argument presenter renders every standard shape and the generic fallback", () => {
  const presenter = new SvgPresenter();
  const svg = new Roll(notation).present(presenter);
  for (const shape of Object.keys(defaultArtwork))
    assert.ok(svg.includes(`data-shape="${shape}"`));
  assert.match(svg, /data-die-type="percentile"/);
  assert.match(svg, /data-die-type="fudge"/);
  assert.doesNotMatch(svg, /undefined|NaN/);
});

test("one icon override retains all other defaults without mutating caller data", () => {
  const original = defaultArtwork.d20;
  const custom = original.replace(
    'class="die-outline"',
    'class="die-outline custom-d20"',
  );
  const overrides = { d20: custom };
  const presenter = new SvgPresenter(overrides, { size: 80 });
  overrides.d20 = "changed afterwards";
  assert.equal(presenter.artwork.d20, custom);
  assert.equal(presenter.artwork.d6, defaultArtwork.d6);
  assert.equal(presenter.artwork.generic, defaultArtwork.generic);
  assert.equal(presenter.appearance.size, 80);
  assert.match(new Roll(notation).present(presenter), /custom-d20/);
  assert.equal(defaultArtwork.d20, original);
  assert.equal(new SvgPresenter().artwork.d20, original);
  assert.ok(Object.isFrozen(presenter.artwork));
});

test("fallback overrides and additional face-count artwork work independently", () => {
  const custom = defaultArtwork.generic.replace(
    'class="die-outline"',
    'class="die-outline custom-fallback"',
  );
  const specific = defaultArtwork.generic.replace(
    'class="die-outline"',
    'class="die-outline custom-d13"',
  );
  const fallback = new Roll("d13").present(
    new SvgPresenter({ generic: custom }),
  );
  assert.match(fallback, /custom-fallback/);
  const presenter = new SvgPresenter({ d13: specific });
  const svg = new Roll("d13 + d17").present(presenter);
  assert.match(svg, /data-shape="d13"/);
  assert.match(svg, /custom-d13/);
  assert.match(svg, /data-shape="generic"/);
  assert.equal(presenter.artwork.generic, defaultArtwork.generic);
});

test("appearance-only settings and existing full-artwork calls remain supported", () => {
  const roll = new Roll("d6");
  const appearance = { size: 80, showNotation: false };
  const a = roll.present(new SvgPresenter(undefined, appearance));
  const b = roll.present(new SvgPresenter(defaultArtwork, appearance));
  assert.doesNotMatch(a, /class="notation"/);
  assert.match(a, /width="80" height="80"/);
  // Each output uses fresh mask identifiers; compare the remaining markup.
  const normalise = (svg: string) => svg.replace(/dice-\d+-/g, "dice-render-");
  assert.equal(normalise(a), normalise(b));
});
