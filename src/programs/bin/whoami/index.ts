import type { Program } from "../types";

export const whoami: Program = {
  name: "whoami",
  help: "usage: whoami [--verbose]",
  run: (args) => ({
    lines: args.includes("--verbose")
      ? [
          "user: blair",
          "roles: AI leader, software engineer, researcher, builder",
          "location: greater sydney area",
          "mission: turn agentic systems into practical leverage",
          "clearance: root by temperament"
        ]
      : ["blair // australian ai and software engineering leader"]
  })
};
