import type { Program } from "../types";

export const systemise: Program = {
  name: "systemise",
  help: "usage: systemise",
  run: (_args, context) => {
    context.launchApp("browser", { url: "blairos://rapid-systemisation" });
    return { lines: ["task pattern captured", "repeatability: improving", "capability now lives in person + system"] };
  }
};
