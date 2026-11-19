import {
  Roll,
  RollHistory,
  engines,
  errors,
} from "@dice-roller/rpg-dice-roller";

export interface RollExampleDefinition {
  readonly id: string;
  readonly notation: string;
  readonly seed: number;
}

/** Only notation and RNG seeds are specified here; the core creates every result. */
export const rollExampleDefinitions: readonly RollExampleDefinition[] = [
  {
    id: "mixed",
    notation: "d2 + d4 + d6 + d8 + d10 + d12 + d20 + d% + 3dF + d13",
    seed: 1,
  },
  {
    id: "maths",
    notation: "floor(((d8 + 3) / 2) * 2) - (d4) + 2^3 % 3",
    seed: 1,
  },
  { id: "keep", notation: "4d6kh3 + 2", seed: 1 },
  { id: "explode-reroll", notation: "d6! + d8r=1", seed: 21 },
  { id: "targets", notation: "4d10>=8=10:2f=1", seed: 10 },
  { id: "criticals", notation: "2d20cs=20cf=1", seed: 80 },
  {
    id: "descriptions",
    notation:
      "{d12 [Weapon damage], d20 // Alternative\n}kh1 [Keep the higher result]",
    seed: 1,
  },
  { id: "custom", notation: "d{0:5} + d{1,1,2,3,5,8} + d{10,20}", seed: 1 },
  { id: "compound", notation: "d6!!", seed: 7 },
  { id: "penetrate", notation: "d6!p", seed: 7 },
  { id: "compound-penetrate", notation: "d6!!p", seed: 7 },
  { id: "unique", notation: "2d6u", seed: 1 },
  { id: "unique-once", notation: "2d6uo", seed: 1 },
  { id: "reroll-once", notation: "2d6ro=1", seed: 6 },
  { id: "bounds", notation: "2d6min3 + 2d6max4", seed: 5 },
  { id: "group-targets", notation: "{d6, d6}>=5f<=2", seed: 7 },
  { id: "keep-group", notation: "{2d6, 2d8}kh1", seed: 1 },
  { id: "drop-group", notation: "{2d6, 2d8}dl1", seed: 1 },
  { id: "multi-pool", notation: "{d6 + d8, d10 + d4}kh1", seed: 1 },
  {
    id: "nested-maths",
    notation: "max(floor((d8 + 3) / 2), ceil((d6 + d4) / 3))",
    seed: 1,
  },
  { id: "calculated-parameters", notation: "(d4 + 1)d(d6 + 2)", seed: 1 },
  { id: "limits-and-amounts", notation: "d6!2:2 + d6ro:2=1", seed: 240 },
];
export const singleRollDefinition: RollExampleDefinition = {
  id: "single",
  notation: "2d20! + 3d8kh1",
  seed: 5,
};

/** Each example gets an independent seeded engine; no roll data is fabricated. */
export function createRollExample(definition: RollExampleDefinition) {
  const engine = new engines.EngineRegistry().create(
    "mersenne",
    definition.seed,
  );
  let draws = 0;
  const roll = new Roll(definition.notation, {
    engine: {
      next() {
        draws++;
        return engine.next();
      },
    },
  });
  return { ...definition, roll, randomDrawCount: () => draws };
}
export type RollExample = ReturnType<typeof createRollExample>;

export function createRollExamples(): readonly RollExample[] {
  return rollExampleDefinitions.map(createRollExample);
}
export function createExampleHistory(
  examples: readonly RollExample[],
): RollHistory {
  const history = new RollHistory();
  history.add(...examples.map((example) => example.roll));
  return history;
}

/** Upgrade candidates are probed with the real core, never replaced by snapshots. */
export const deferredExampleDefinitions: readonly RollExampleDefinition[] = [
  { id: "comparison-true", notation: "(2d6+4)>10", seed: 1 },
  { id: "comparison-false", notation: "(2d6+4)>10", seed: 2 },
  {
    id: "conditional-true",
    notation: "((d20)>=10) ? (2d8+$condition) : (d4)",
    seed: 1,
  },
  {
    id: "conditional-false",
    notation: "((d20)>=10) ? (2d8+$condition) : (d4)",
    seed: 4,
  },
  { id: "conditional-shorthand", notation: "(d6) ?: (d8)", seed: 1 },
  {
    id: "conditional-nested",
    notation: "((d20)>=10) ? (((d6)>3) ? ($condition+2) : (d4)) : (0)",
    seed: 1,
  },
  { id: "comparison-arithmetic", notation: "((2d6)>(d8+2))*5", seed: 1 },
  {
    id: "conditional-group",
    notation: "{((d6)>3) ? (d8) : (d4), d12}kh1",
    seed: 1,
  },
  {
    id: "comparison-function",
    notation: "max(((d6)>3), ((0) ? (d20) : (d8)))",
    seed: 1,
  },
  { id: "group-criticals", notation: "{d6, d6}>=5f<=2cs=6cf=1", seed: 7 },
];
export type DeferredExample =
  | { readonly status: "available"; readonly example: RollExample }
  | {
      readonly status: "unavailable";
      readonly definition: RollExampleDefinition;
      readonly reason: string;
    };

export function createDeferredExamples(): readonly DeferredExample[] {
  return deferredExampleDefinitions.map((definition) => {
    try {
      return { status: "available", example: createRollExample(definition) };
    } catch (error) {
      // Only errors raised by the core's parse/evaluation boundary are reported.
      // Presentation runs outside this catch, so integration failures stay visible.
      if (!(error instanceof errors.DiceRollerError)) throw error;
      return { status: "unavailable", definition, reason: error.message };
    }
  });
}
