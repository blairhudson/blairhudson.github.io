import { less } from "../less";
import type { Program } from "../types";

export const more: Program = { ...less, name: "more", help: "usage: more <file>" };
