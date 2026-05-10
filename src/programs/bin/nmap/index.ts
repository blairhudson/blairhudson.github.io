import type { Program } from "../types";

export const nmap: Program = {
  name: "nmap",
  help: "usage: nmap <host>",
  run: (args) => {
    const host = args[0] || "localhost";
    const local = host === "localhost" || host === "127.0.0.1";
    return {
      lines: [
        `Starting Nmap 7.94 against ${host}`,
        local ? "22/tcp   open  ssh          tiny terminal gremlin" : "80/tcp   open  http         browser portal",
        local ? "4242/tcp open  agent        sandbox control plane" : "443/tcp  open  https        polished surface",
        local ? "8080/tcp open  ideas        backlog reactor" : "9000/tcp open  demos        stage lights",
        "Service Info: OS: BlairOS; CPE: cpe:/o:blair:desktop"
      ]
    };
  }
};
