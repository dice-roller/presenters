# Terminal presenter

An optional presenter for RPG Dice Roller v6. It uses the same layout and modifier
symbols as the built-in text presenter, with optional ANSI styling.

```typescript
import { Roll } from "@dice-roller/rpg-dice-roller";
import { TerminalPresenter } from "@dice-roller/terminal-presenter";

const presenter = new TerminalPresenter({ color: true });
const roll = new Roll("4d6kh3");
console.log(roll.present(presenter));
```

The final total is bold, and dropped dice and group members are dimmed in full.
Success and failure markers are green and red, explosion markers are yellow,
reroll markers are cyan, and drop markers are grey.

The presenter returns a string. The `color` option defaults to `false`, producing
the same plain text as `TextPresenter`. Enable it when the destination supports
ANSI. For a CLI, use the destination stream’s terminal capabilities and the
user’s colour preference to choose the setting.

The text presenter options `flagSymbols`, `separator` and `expandInlineRolls` also
work with `TerminalPresenter`. It accepts rolls, histories and evaluated
expression results.
