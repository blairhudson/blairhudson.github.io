import { findNode, normalizePath } from "../../../os/kernel/filesystem";
import type { Program } from "../types";

export const less: Program = {
  name: "less",
  help: "usage: less <file>",
  run: (args, context) => {
    const file = args[0];
    if (!file) return { lines: ["less: missing file"] };
    const node = findNode(normalizePath(file, context.cwd));
    if (!node?.body) return { lines: [`less: ${file}: no readable text`] };
    return { lines: node.body.split(/\r?\n/).slice(0, 80) };
  }
};
