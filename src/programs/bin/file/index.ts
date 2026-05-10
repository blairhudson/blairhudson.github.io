import { findNode, normalizePath } from "../../../os/kernel/filesystem";
import type { Program } from "../types";

export const file: Program = {
  name: "file",
  help: "usage: file <path>",
  run: (args, context) => {
    const target = args[0];
    if (!target) return { lines: ["file: missing operand"] };
    const path = normalizePath(target, context.cwd);
    const node = findNode(path);
    if (!node) return { lines: [`${path}: cannot open`] };
    return { lines: [`${path}: ${node.type}${node.href ? " URL shortcut" : node.body ? " text" : ""}`] };
  }
};
