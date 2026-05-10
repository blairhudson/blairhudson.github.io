import { findNode, normalizePath } from "../../../os/kernel/filesystem";
import type { Program } from "../types";

export const grep: Program = {
  name: "grep",
  help: "usage: grep <text> <file>",
  run: (args, context) => {
    const [needle, file] = args;
    if (!needle || !file) return { lines: ["grep: usage: grep <text> <file>"] };
    const node = findNode(normalizePath(file, context.cwd));
    if (!node?.body) return { lines: [`grep: ${file}: no readable text`] };
    const lines = node.body.split(/\r?\n/).filter((line) => line.toLowerCase().includes(needle.toLowerCase()));
    return { lines: lines.length ? lines : [`grep: no matches for ${needle}`] };
  }
};
