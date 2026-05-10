import { findNode, normalizePath } from "../../../os/kernel/filesystem";
import type { Program } from "../types";

export const wc: Program = {
  name: "wc",
  help: "usage: wc <file>",
  run: (args, context) => {
    const file = args[0];
    if (!file) return { lines: ["wc: missing file"] };
    const node = findNode(normalizePath(file, context.cwd));
    if (!node?.body) return { lines: [`wc: ${file}: no readable text`] };
    const lines = node.body.split(/\r?\n/).length;
    const words = node.body.trim() ? node.body.trim().split(/\s+/).length : 0;
    return { lines: [`${lines} ${words} ${node.body.length} ${file}`] };
  }
};
