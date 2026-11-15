import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fillValueSlot } from "../dist/svg/value-slot.js";

const icon = (name: string): string =>
  readFileSync(new URL(`../assets/dice/${name}.svg`, import.meta.url), "utf8");

test("all icons own one empty value slot, preserving their text positions", () => {
  for (const name of ["d2", "d4", "d6", "d8", "d10", "d12", "d20", "generic"]) {
    const template = icon(name);
    assert.equal((template.match(/data-slot="value"/g) ?? []).length, 1);
    const rendered = fillValueSlot(template, 12);
    assert.match(rendered, />12<\/text>/);
    const renderedPosition = rendered.match(/\bx="50" y="\d+"/);
    const templatePosition = template.match(/\bx="50" y="\d+"/);
    assert.ok(renderedPosition);
    assert.ok(templatePosition);
    assert.equal(renderedPosition[0], templatePosition[0]);
  }
});

test("values are XML escaped rather than interpreted as markup", () => {
  const rendered = fillValueSlot(icon("d6"), "<script>\"&'</script>");
  assert.ok(!rendered.includes("<script>"));
  assert.ok(
    rendered.includes("&lt;script&gt;&quot;&amp;&apos;&lt;/script&gt;"),
  );
});

test("percentile values fit using the d10 slot without a per-die exception", () => {
  const template = icon("d10");
  assert.match(fillValueSlot(template, 10), /font-size="22"/);
  assert.match(fillValueSlot(template, 100), /font-size="16\.67"/);
  assert.match(fillValueSlot(icon("d6"), 100), /font-size="22"/);
});

test("Fudge symbols and empty values retain the same slot", () => {
  for (const value of ["−", "", "+"]) {
    assert.ok(fillValueSlot(icon("d6"), value).includes(`>${value}</text>`));
  }
});
