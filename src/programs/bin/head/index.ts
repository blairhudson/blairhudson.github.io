import { findNode, normalizePath } from "../../../os/kernel/filesystem";
import type { Program } from "../types";

export const head: Program = {
  name: "head",
  help: "usage: head [file]",
  run: (args, context) => {
    const file = args[0];
    if (!file) return { lines: ["head: missing file"] };
    const node = findNode(normalizePath(file, context.cwd));
    if (!node?.body) return { lines: [`head: ${file}: no readable text`] };
    return { lines: node.body.split(/\r?\n/).slice(0, 10) };
  }
};
