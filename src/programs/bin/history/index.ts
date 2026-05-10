import type { Program } from "../types";

export const history: Program = {
  name: "history",
  help: "usage: history",
  run: () => {
    try {
      const lines = JSON.parse(localStorage.getItem("blairos.history") ?? "[]") as string[];
      return { lines: lines.map((line, index) => `${String(index + 1).padStart(4)}  ${line}`) };
    } catch {
      return { lines: [] };
    }
  }
};
