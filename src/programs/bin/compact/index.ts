import type { Program } from "../types";

export const compact: Program = {
  name: "compact",
  help: "usage: compact",
  run: () => ({
    lines: [
      "compacting role context...",
      "kept: systems, people patterns, edge cases, judgment",
      "dropped: stale detail, meeting fog, old acronyms",
      "new context window available"
    ]
  })
};
