import { dig } from "../dig";
import type { Program } from "../types";

export const nslookup: Program = { ...dig, name: "nslookup", help: "usage: nslookup <host>" };
