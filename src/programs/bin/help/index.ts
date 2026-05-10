import type { Program } from "../types";

export const help: Program = {
  name: "help",
  help: "usage: help",
  run: () => ({
    lines: [
      "available programs:",
      "help sh ls cd pwd cat echo open date env uname whoami hostname which man",
      "tree find grep wc head tail sort uniq basename dirname ps kill",
      "mkdir rm touch cp mv chmod clear sleep fortune reboot matrix",
      "sudo coffee nmap workslop sprint compact systemise sublight proof broadband chatbox"
    ]
  })
};
