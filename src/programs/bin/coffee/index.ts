import type { Program } from "../types";

export const coffee: Program = {
  name: "coffee",
  help: "usage: coffee",
  run: () => {
    localStorage.setItem("blairos.caffeinated", new Date().toISOString());
    return { lines: ["caffeination enabled", "sleep prevention: active", "brew strength: unreasonable"] };
  }
};
