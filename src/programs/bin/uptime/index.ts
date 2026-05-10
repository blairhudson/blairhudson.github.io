import type { Program } from "../types";

const started = Date.now();

export const uptime: Program = {
  name: "uptime",
  help: "usage: uptime",
  run: () => {
    const seconds = Math.floor((Date.now() - started) / 1000);
    return { lines: [`up ${Math.floor(seconds / 60)} min, ${seconds % 60} sec, 1 user, load averages: 0.42 0.24 0.12`] };
  }
};
