import { findNode, normalizePath } from "../../../os/kernel/filesystem";
import type { Program } from "../types";

export const sort: Program = {
  name: "sort",
  help: "usage: sort <file|words ...>",
  run: (args, context) => {
    if (!args.length) return { lines: ["sort: missing input"] };
    const node = findNode(normalizePath(args[0], context.cwd));
    const lines = node?.body ? node.body.split(/\r?\n/) : args;
    return { lines: [...lines].sort((a, b) => a.localeCompare(b)) };
  }
};
