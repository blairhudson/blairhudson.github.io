import type { Program } from "../types";

export const date: Program = {
  name: "date",
  help: "usage: date",
  run: () => ({ lines: [new Date().toString()] })
};
