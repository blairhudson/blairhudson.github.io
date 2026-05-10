import { findNode, normalizePath } from "../../../os/kernel/filesystem";
import type { FsNode } from "../../../os/data/filesystem";
import type { Program } from "../types";

function size(node: FsNode): number {
  return (node.body?.length ?? 0) + (node.href?.length ?? 0) + (node.children ?? []).reduce((sum, child) => sum + size(child), 0);
}

export const du: Program = {
  name: "du",
  help: "usage: du [path]",
  run: (args, context) => {
    const path = normalizePath(args[0] ?? context.cwd, context.cwd);
    const node = findNode(path);
    if (!node) return { lines: [`du: ${path}: no such file or directory`] };
    return { lines: [`${size(node)}\t${node.path}`] };
  }
};
