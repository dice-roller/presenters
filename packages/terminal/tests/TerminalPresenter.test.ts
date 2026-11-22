import assert from "node:assert/strict";
import { test } from "node:test";
import { stripVTControlCharacters } from "node:util";
import {
  Roll,
  RollHistory,
  engines,
  presenters,
} from "@dice-roller/rpg-dice-roller";
import { TerminalPresenter } from "../dist/index.js";

function seededRoll(notation: string, seed: number) {
  const engine = new engines.EngineRegistry().create("mersenne", seed);
  return new Roll(notation, { engine });
}

test("plain text is the default and disabling colour matches TextPresenter", () => {
  const roll = seededRoll("4d6kh3", 1);
  const expected = roll.present(new presenters.TextPresenter());

  assert.equal(roll.present(new TerminalPresenter()), expected);
  assert.equal(roll.present(new TerminalPresenter({ color: false })), expected);
});

test("colours modifier markers and resets intensity after dropped dice and totals", () => {
  const presenter = new TerminalPresenter({ color: true });
  const tests = [
    [
      "4d6kh3 + 2",
      1,
      "4d6kh3 + 2: [4, 4, 5, \x1b[2m1\x1b[90md\x1b[39m\x1b[22m]+2 = \x1b[1m15\x1b[22m",
    ],
    [
      "d6! + d8r=1",
      21,
      "d6! + d8r=1: [6\x1b[33m!\x1b[39m, 2]+[5\x1b[36mr\x1b[39m] = \x1b[1m13\x1b[22m",
    ],
    [
      "4d10>=8=10:2f=1",
      10,
      "4d10>=8=10:2f=1: [10\x1b[32m**\x1b[39m, 4, 1\x1b[31m_\x1b[39m, 6] = \x1b[1m1\x1b[22m",
    ],
    [
      "{2d6, 2d8}kh1",
      1,
      "{2d6, 2d8}kh1: {[4, 4], \x1b[2m([5, 1])\x1b[90md\x1b[39m\x1b[22m} = \x1b[1m8\x1b[22m",
    ],
  ] as const;

  for (const [notation, seed, expected] of tests) {
    assert.equal(seededRoll(notation, seed).present(presenter), expected);
  }
});

test("a dropped group member stays dim after a nested drop", () => {
  const roll = seededRoll("{4d6kh3+2, 100}kh1", 1);
  const styled = roll.present(new TerminalPresenter({ color: true }));

  assert.equal(
    styled,
    "{4d6kh3+2, 100}kh1: {\x1b[2m([4, 4, 5, \x1b[2m1\x1b[90md\x1b[39m\x1b[22m\x1b[2m]+2)\x1b[90md\x1b[39m\x1b[22m, 100} = \x1b[1m100\x1b[22m",
  );
  assert.equal(stripVTControlCharacters(styled), roll.present());
});

test("ANSI styling preserves custom symbols and text layout for results and histories", () => {
  const options: presenters.TextPresenterOptions = {
    expandInlineRolls: true,
    separator: "\n",
    flagSymbols: { "target-success": " yes", "target-failure": "" },
  };
  const plain = new presenters.TextPresenter(options);
  const terminal = new TerminalPresenter({ ...options, color: true });
  const history = new RollHistory();
  assert.equal(history.present(terminal), "");

  const weighted = seededRoll("4d10>=8=10:2f=1", 10);
  history.add(
    weighted,
    seededRoll("(d4 + 1)d(d6 + 2)", 1),
    seededRoll("((d20)>=10) ? (2d8+$$condition) : (d4)", 1),
  );

  const styledResult = terminal.present(weighted.result);
  assert.equal(styledResult, "[10\x1b[32m yes yes\x1b[39m, 4, 1, 6]");
  assert.equal(
    stripVTControlCharacters(styledResult),
    plain.present(weighted.result),
  );
  assert.equal(
    stripVTControlCharacters(history.present(terminal)),
    history.present(plain),
  );
});
