import { findNode, normalizePath } from "../../../os/kernel/filesystem";
import type { Program } from "../types";

export const tail: Program = {
  name: "tail",
  help: "usage: tail [file]",
  run: (args, context) => {
    const file = args[0];
    if (!file) return { lines: ["tail: missing file"] };
    const node = findNode(normalizePath(file, context.cwd));
    if (!node?.body) return { lines: [`tail: ${file}: no readable text`] };
    return { lines: node.body.split(/\r?\n/).slice(-10) };
  }
};
