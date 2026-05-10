import { createNode, findNode, normalizePath, writeDocument } from "../../../os/kernel/filesystem";
import type { Program } from "../types";

function targetUrl(raw: string) {
  return /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
}

function outputName(args: string[], target: string) {
  const explicit = args.findIndex((arg) => arg === "-O" || arg === "--output-document");
  if (explicit >= 0 && args[explicit + 1]) return args[explicit + 1];
  try {
    return new URL(target).pathname.split("/").filter(Boolean).at(-1) || "index.html";
  } catch {
    return "index.html";
  }
}

export const wget: Program = {
  name: "wget",
  help: "usage: wget [-O file] <url>",
  run: async (args, context) => {
    const raw = args.find((arg, index) => !arg.startsWith("-") && args[index - 1] !== "-O" && args[index - 1] !== "--output-document") ?? "blairhudson.com";
    const target = targetUrl(raw);
    const outputPath = normalizePath(outputName(args, target), context.cwd);
    try {
      const response = await fetch(target);
      const body = await response.text();
      const error = findNode(outputPath) ? writeDocument(outputPath, body) : createNode(outputPath, "document", body);
      if (error) return { lines: [`wget: ${error}`] };
      return { lines: [`-- saved ${target}`, `HTTP ${response.status} ${response.statusText}`.trim(), `Length: ${body.length}`, `Saving to: ${outputPath}`] };
    } catch (error) {
      return { lines: [`wget: ${target}: ${error instanceof Error ? error.message : "download failed"}`] };
    }
  }
};
