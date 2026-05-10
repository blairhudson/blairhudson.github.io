import { findNode, normalizePath } from "../../../os/kernel/filesystem";
import type { Program } from "../types";

export const cat: Program = {
  name: "cat",
  help: "usage: cat <file>",
  run: (args, context) => {
    const target = args[0];
    if (!target) return { lines: ["cat: missing file"] };
    const node = findNode(normalizePath(target, context.cwd));
    if (!node) return { lines: [`cat: ${target}: no such file`] };
    return { lines: [node.body || `${node.name}: ${node.type}`] };
  }
};
