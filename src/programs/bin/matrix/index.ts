import type { Program } from "../types";

export const matrix: Program = {
  name: "matrix",
  help: "usage: matrix",
  run: () => ({
    lines: ["entering matrix rain", "press any key to exit"]
  })
};
