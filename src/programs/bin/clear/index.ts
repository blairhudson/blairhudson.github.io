import type { Program } from "../types";

export const clear: Program = {
  name: "clear",
  help: "usage: clear",
  run: (_, context) => {
    context.clear();
    return { lines: [] };
  }
};
