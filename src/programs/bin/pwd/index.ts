import type { Program } from "../types";

export const pwd: Program = {
  name: "pwd",
  help: "usage: pwd",
  run: (_, context) => ({ lines: [context.cwd] })
};
