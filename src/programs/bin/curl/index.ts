import type { Program } from "../types";

function url(arg?: string) {
  if (!arg) return "https://blairhudson.com";
  return /^https?:\/\//.test(arg) ? arg : `https://${arg}`;
}

export const curl: Program = {
  name: "curl",
  help: "usage: curl [-I] <url>",
  run: async (args) => {
    const headersOnly = args.includes("-I") || args.includes("--head");
    const target = url(args.find((arg) => !arg.startsWith("-")));
    try {
      const response = await fetch(target, { method: headersOnly ? "HEAD" : "GET" });
      const headerLines = [`HTTP ${response.status} ${response.statusText}`.trim(), ...[...response.headers.entries()].map(([key, value]) => `${key}: ${value}`)];
      if (headersOnly) return { lines: headerLines };
      const body = await response.text();
      return { lines: body ? body.split("\n") : headerLines };
    } catch (error) {
      return { lines: [`curl: ${target}: ${error instanceof Error ? error.message : "connection failed"}`] };
    }
  }
};
