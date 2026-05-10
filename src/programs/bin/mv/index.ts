import { moveNode, normalizePath } from "../../../os/kernel/filesystem";
import type { Program } from "../types";

export const mv: Program = {
  name: "mv",
  help: "usage: mv <source> <dest>",
  run: (args, context) => {
    const [source, dest] = args;
    if (!source || !dest) return { lines: ["mv: usage: mv <source> <dest>"] };
    const from = normalizePath(source, context.cwd);
    const to = normalizePath(dest, context.cwd);
    const error = moveNode(from, to);
    return { lines: [error ? `mv: ${error}` : `moved ${from} -> ${to}`] };
  }
};
