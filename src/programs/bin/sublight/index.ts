import type { Program } from "../types";

export const sublight: Program = {
  name: "sublight",
  help: "usage: sublight",
  run: (_args, context) => {
    context.launchApp("browser", { url: "blairos://sublight" });
    return { lines: ["sublight engines engaged", "leaving hype gravity field", "destination: work that matters"] };
  }
};
