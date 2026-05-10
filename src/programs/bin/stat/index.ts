import { findNode, normalizePath } from "../../../os/kernel/filesystem";
import type { Program } from "../types";

export const stat: Program = {
  name: "stat",
  help: "usage: stat <path>",
  run: (args, context) => {
    const target = args[0];
    if (!target) return { lines: ["stat: missing operand"] };
    const path = normalizePath(target, context.cwd);
    const node = findNode(path);
    if (!node) return { lines: [`stat: ${path}: no such file or directory`] };
    return { lines: [`Path: ${node.path}`, `Name: ${node.name}`, `Type: ${node.type}`, `Size: ${(node.body ?? node.href ?? "").length} bytes`, `Children: ${node.children?.length ?? 0}`] };
  }
};
