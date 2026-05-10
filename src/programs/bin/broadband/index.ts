import type { Program } from "../types";

export const broadband: Program = {
  name: "broadband",
  help: "usage: broadband",
  run: (_args, context) => {
    context.launchApp("browser", { url: "blairos://broadband-ai" });
    return { lines: ["weeee-aww bzzz bzz eeeee", "dial-up AI disconnected", "broadband token lane online"] };
  }
};
