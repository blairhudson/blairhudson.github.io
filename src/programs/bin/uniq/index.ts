import { findNode, normalizePath } from "../../../os/kernel/filesystem";
import type { Program } from "../types";

export const uniq: Program = {
  name: "uniq",
  help: "usage: uniq <file|words ...>",
  run: (args, context) => {
    if (!args.length) return { lines: ["uniq: missing input"] };
    const node = findNode(normalizePath(args[0], context.cwd));
    const lines = node?.body ? node.body.split(/\r?\n/) : args;
    return { lines: lines.filter((line, index) => index === 0 || line !== lines[index - 1]) };
  }
};
