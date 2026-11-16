import assert from "node:assert/strict";
import { test } from "node:test";
import { Roll, RollHistory } from "@dice-roller/rpg-dice-roller";
import { SvgPresenter } from "../dist/index.js";

const dimensions = (svg: string) => {
  const match = svg.match(/^<svg[^>]* width="([\d.]+)" height="([\d.]+)"/);
  assert.ok(match);
  return { width: Number(match[1]), height: Number(match[2]) };
};
// Include enclosing group translations when comparing nested dice positions.
const dice = (svg: string) => {
  const stack = [{ x: 0, y: 0 }];
  const result: { x: number; y: number; width: number }[] = [];
  for (const match of svg.matchAll(/<\/?(?:g|svg)\b[^>]*>/g)) {
    const tag = match[0];
    if (tag.startsWith("</")) {
      stack.pop();
      continue;
    }
    const parent = stack[stack.length - 1]!;
    const offset = tag.match(/transform="translate\(([\d.-]+)[ ,]+([\d.-]+)/);
    const attribute = (name: string) =>
      Number(tag.match(new RegExp(`\\b${name}="([\\d.-]+)"`))?.[1] ?? 0);
    const position = {
      x: parent.x + Number(offset?.[1] ?? 0) + attribute("x"),
      y: parent.y + Number(offset?.[2] ?? 0) + attribute("y"),
    };
    if (tag.startsWith("<svg ") && tag.includes('viewBox="0 0 100 100"'))
      result.push({ ...position, width: attribute("width") });
    if (!tag.endsWith("/>")) stack.push(position);
  }
  return result;
};

test("width defaults to 1040 and narrower widths wrap dice sooner", () => {
  const roll = new Roll("12d6");
  const standard = roll.present(new SvgPresenter());
  const narrow = roll.present(new SvgPresenter({ width: 400 }));
  const wide = roll.present(new SvgPresenter({ width: 2400 }));
  assert.equal(dimensions(standard).width, 1040);
  assert.equal(dimensions(narrow).width, 400);
  assert.equal(dimensions(wide).width, 2400);
  assert.ok(dimensions(narrow).height > dimensions(standard).height);
  assert.ok(dimensions(standard).height > dimensions(wide).height);
  assert.equal(dice(narrow).length, 12);
  assert.equal(new Set(dice(wide).map((die) => die.y)).size, 1);
});

test("noWrap keeps nested functions, groups and all their pools on one expression line", () => {
  const roll = new Roll("max((6d6 + 2), (6d8 + 1)) + {4d4, 4d10}kh1");
  const svg = roll.present(new SvgPresenter({ width: 100, noWrap: true }));
  const icons = dice(svg);
  assert.equal(icons.length, 20);
  assert.equal(new Set(icons.map((die) => die.y)).size, 1);
  const { width } = dimensions(svg);
  assert.ok(width > 1040);
  for (const die of icons) assert.ok(die.x + die.width <= width - 24);
  assert.doesNotMatch(svg, /Infinity|NaN|undefined/);
});

test("noWrap sizes short rolls to content instead of retaining the wrapping width", () => {
  const roll = new Roll("d6");
  const svg = roll.present(new SvgPresenter({ noWrap: true, width: 2000 }));
  assert.ok(dimensions(svg).width < 1040);
  assert.ok(dimensions(svg).width > 48);
  assert.equal(dice(svg).length, 1);
});

test("notation wraps at the configured width and stays on one line with noWrap", () => {
  const roll = new Roll("d6");
  const target = {
    notation: "d6 + ".repeat(100) + "1",
    result: roll.result,
    total: roll.total,
  };
  const narrow = new SvgPresenter({ width: 300 }).present(target);
  const wide = new SvgPresenter({ width: 1200 }).present(target);
  const unwrapped = new SvgPresenter({ noWrap: true }).present(target);
  const lines = (svg: string) => (svg.match(/class="notation"/g) ?? []).length;
  assert.ok(lines(narrow) > lines(wide));
  assert.equal(lines(unwrapped), 1);
  assert.ok(dimensions(unwrapped).width > 1200);
  const hidden = new SvgPresenter({
    noWrap: true,
    showNotation: false,
  }).present(target);
  assert.equal(lines(hidden), 0);
  assert.ok(dimensions(hidden).width < dimensions(unwrapped).width);
});

test("unwrapped histories retain separate rolls and share content-sized dividers", () => {
  const history = new RollHistory();
  history.add(new Roll("10d6"), new Roll("d8"));
  const svg = history.present(new SvgPresenter({ noWrap: true }));
  const icons = dice(svg);
  assert.equal(icons.length, 11);
  assert.equal(new Set(icons.slice(0, 10).map((die) => die.y)).size, 1);
  assert.ok(icons[10]!.y > icons[0]!.y);
  const width = dimensions(svg).width;
  for (const match of svg.matchAll(/H([\d.]+)" class="divider"/g))
    assert.equal(Number(match[1]), width - 24);
  assert.equal((svg.match(/class="divider"/g) ?? []).length, 2);
  assert.ok(svg.includes(`History total: ${history.total}`));
});

test("width validation rejects non-finite values and widths without content space", () => {
  const roll = new Roll("d6");
  for (const width of [NaN, Infinity, -Infinity, 0, -1, 48]) {
    assert.throws(() => roll.present(new SvgPresenter({ width })), /SVG width/);
  }
  assert.doesNotThrow(() => roll.present(new SvgPresenter({ width: 49 })));
});
