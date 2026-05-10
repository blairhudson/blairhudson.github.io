import type { Program } from "../types";

export const traceroute: Program = {
  name: "traceroute",
  help: "usage: traceroute <host>",
  run: (args) => {
    const host = args[0] ?? "blairhudson.com";
    return { lines: [`traceroute to ${host}`, "1  blairos.local  1.1 ms", "2  syd.edge  8.9 ms", `3  ${host}  18.0 ms`] };
  }
};
