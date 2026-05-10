import { copyNode, normalizePath } from "../../../os/kernel/filesystem";
import type { Program } from "../types";

export const cp: Program = {
  name: "cp",
  help: "usage: cp <source> <dest>",
  run: (args, context) => {
    const [source, dest] = args;
    if (!source || !dest) return { lines: ["cp: usage: cp <source> <dest>"] };
    const from = normalizePath(source, context.cwd);
    const to = normalizePath(dest, context.cwd);
    const error = copyNode(from, to);
    return { lines: [error ? `cp: ${error}` : `copied ${from} -> ${to}`] };
  }
};
