import type { Program } from "../types";

export const sprint: Program = {
  name: "sprint",
  help: "usage: sprint",
  run: (_args, context) => {
    context.launchApp("browser", { url: "blairos://weekend-sprint" });
    return { lines: ["weekend sprint report opened", "metric: proof of work > badge energy"] };
  }
};
