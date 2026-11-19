import {
  createRollExample,
  decisionExampleDefinitions,
} from "../../../../demo/svg/roll-examples.js";

export const decisionExamples = decisionExampleDefinitions.map(
  (definition) => createRollExample(definition).roll,
);
