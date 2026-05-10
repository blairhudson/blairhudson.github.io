import { programRegistry } from "../../programs/bin";
import { findNode, normalizePath, writeDocument } from "./filesystem";
import type { CommandContext } from "./types";

function tokenize(input: string) {
  return [...input.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((match) => match[1] ?? match[2] ?? match[3]);
}

function expandAliases(input: string) {
  try {
    const aliases = JSON.parse(localStorage.getItem("blairos.aliases") ?? "{}") as Record<string, string>;
    const [head, ...rest] = tokenize(input);
    return aliases[head] ? `${aliases[head]} ${rest.join(" ")}`.trim() : input;
  } catch {
    return input;
  }
}

async function runOne(input: string, context: CommandContext, stdin: string[] = []) {
  const redirect = input.match(/\s(>>|>)\s(.+)$/);
  const command = redirect ? input.slice(0, redirect.index).trim() : input;
  const [rawProgram, ...args] = tokenize(command);
  if (!rawProgram) return [];
  const name = rawProgram.replace(/^\/bin\//, "").toLowerCase();
  const program = programRegistry[name];

  if (!program) return [`command not found: ${rawProgram}`];
  if (args[0] === "--help") return [program.help];

  const result = await program.run(stdin.length ? [...args, ...stdin] : args, context);
  const lines = result.lines ?? [];
  if (redirect) {
    const target = normalizePath(redirect[2], context.cwd);
    const existing = redirect[1] === ">>" ? findNode(target)?.body ?? "" : "";
    const error = writeDocument(target, `${existing}${existing ? "\n" : ""}${lines.join("\n")}`);
    return [error ?? target];
  }
  return lines;
}

export function runCommand(input: string, context: CommandContext) {
  const trimmed = expandAliases(input.trim());
  if (!trimmed) return [];
  try {
    const history = JSON.parse(localStorage.getItem("blairos.history") ?? "[]") as string[];
    localStorage.setItem("blairos.history", JSON.stringify([...history.slice(-99), trimmed]));
  } catch {
    // History is best-effort only.
  }

  return trimmed.split("|").reduce<Promise<string[]>>(async (stdin, part) => runOne(part.trim(), context, await stdin), Promise.resolve([]));
}

export function commandNames() {
  return Object.keys(programRegistry).sort();
}

export { tokenize };
