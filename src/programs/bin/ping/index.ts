import type { Program } from "../types";

export const ping: Program = {
  name: "ping",
  help: "usage: ping <host>",
  run: (args) => {
    const host = args[0] ?? "blairhudson.com";
    return { lines: [`PING ${host}`, "64 bytes from edge: icmp_seq=0 ttl=54 time=18.2 ms", "64 bytes from edge: icmp_seq=1 ttl=54 time=17.8 ms", "2 packets transmitted, 2 packets received"] };
  }
};
