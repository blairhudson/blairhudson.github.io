import type { Program } from "../types";

export const chatbox: Program = {
  name: "chatbox",
  help: "usage: chatbox",
  run: (_args, context) => {
    context.launchApp("browser", { url: "blairos://chat-is-not-the-workflow" });
    return { lines: ["chatbox inspected", "finding: useful interface, bad operating model", "fix: put AI in workflow"] };
  }
};
