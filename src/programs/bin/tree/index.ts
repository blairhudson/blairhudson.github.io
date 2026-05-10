import { findNode, normalizePath } from "../../../os/kernel/filesystem";
import type { FsNode } from "../../../os/data/filesystem";
import type { Program } from "../types";

function walk(node: FsNode, prefix = ""): string[] {
  const children = node.children ?? [];
  return children.flatMap((child, index) => {
    const last = index === children.length - 1;
    const line = `${prefix}${last ? "`--" : "|--"} ${child.name}`;
    const nested = child.children ? walk(child, `${prefix}${last ? "    " : "|   "}`) : [];
    return [line, ...nested];
  });
}

export const tree: Program = {
  name: "tree",
  help: "usage: tree [path]",
  run: (args, context) => {
    const path = normalizePath(args[0] ?? context.cwd, context.cwd);
    const node = findNode(path);
    if (!node) return { lines: [`tree: ${path}: no such file or directory`] };
    return { lines: [node.name, ...walk(node)] };
  }
};
