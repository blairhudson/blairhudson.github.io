import type { Program } from "../types";

export const proof: Program = {
  name: "proof",
  help: "usage: proof",
  run: (_args, context) => {
    context.launchApp("browser", { url: "blairos://proof-of-work" });
    return { lines: ["credential type: proof of work", "evidence: real project", "badge energy: optional"] };
  }
};
