import type { Program } from "../types";

export const dig: Program = {
  name: "dig",
  help: "usage: dig <host>",
  run: (args) => {
    const host = args[0] ?? "blairhudson.com";
    return { lines: [`${host}. 300 IN A 76.76.21.21`, `${host}. 300 IN CNAME cname.vercel-dns.com.`] };
  }
};
