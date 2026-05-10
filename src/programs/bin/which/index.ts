import { findNode } from "../../../os/kernel/filesystem";
import type { Program } from "../types";

export const which: Program = {
  name: "which",
  help: "usage: which <program ...>",
  run: (args) => {
    if (!args.length) return { lines: ["which: missing program"] };
    return { lines: args.map((name) => (findNode(`/bin/${name}`) ? `/bin/${name}` : `${name} not found`)) };
  }
};
