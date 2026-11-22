import { presenters } from "@dice-roller/rpg-dice-roller";
import type { Roll, results } from "@dice-roller/rpg-dice-roller";

export interface TerminalPresenterOptions
  extends presenters.TextPresenterOptions {
  /** Adds ANSI styling to the output. Defaults to false. */
  color?: boolean;
}

const flagColours: Partial<Record<results.ResultFlag, number>> = {
  compound: 33,
  explode: 33,
  "explode-matching-batch": 33,
  "explode-matching-batch-failure": 31,
  "critical-failure": 31,
  "critical-success": 32,
  drop: 90,
  penetrate: 33,
  "re-roll": 36,
  "re-roll-once": 36,
  "target-failure": 31,
  "target-success": 32,
};

function style(text: string, open: number, close: number): string {
  return text === "" ? text : `\x1b[${open}m${text}\x1b[${close}m`;
}

function bold(text: string): string {
  return style(text, 1, 22);
}

function dim(text: string): string {
  // A nested dropped result may reset intensity before this result ends.
  return style(text.replaceAll("\x1b[22m", "\x1b[22m\x1b[2m"), 2, 22);
}

function colour(text: string, foreground: number): string {
  return style(text, foreground, 39);
}

/** TextPresenter output with optional ANSI styling for terminal display. */
export class TerminalPresenter extends presenters.TextPresenter {
  readonly color: boolean;

  constructor(options: TerminalPresenterOptions = {}) {
    super(options);
    this.color = options.color ?? false;
  }

  protected override roll(roll: Roll<unknown>): string {
    if (!this.color) {
      return super.roll(roll);
    }

    const total = bold(this.formatNumber(roll.total));
    return `${roll.notation}: ${this.visit(roll.result)} = ${total}`;
  }

  protected override die(
    result: results.DieResult,
    pool: results.PoolResult,
  ): string {
    const text = super.die(result, pool);
    return this.color && result.flags.includes("drop") ? dim(text) : text;
  }

  protected override member(member: results.GroupMemberResult): string {
    const text = super.member(member);
    return this.color && member.flags.includes("drop") ? dim(text) : text;
  }

  protected override flags(
    flags: readonly results.ResultFlag[],
    calculationValue: number,
  ): string {
    if (!this.color) {
      return super.flags(flags, calculationValue);
    }

    return flags
      .map((flag) => {
        const text = super.flags([flag], calculationValue);
        const foreground = flagColours[flag];
        return foreground === undefined ? text : colour(text, foreground);
      })
      .join("");
  }
}
