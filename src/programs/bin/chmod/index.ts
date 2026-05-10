import type { Program } from "../types";

export const chmod: Program = {
  name: "chmod",
  help: "usage: chmod <mode> <path>",
  run: () => ({ lines: ["chmod: permission bits not supported"] })
};
