import { atom } from "nanostores";

export type LogEntry = {
  id: string;
  time: string;
  source: string;
  message: string;
};

const STORAGE_KEY = "blairos.logs.v1";

function readLogs() {
  if (typeof globalThis.localStorage === "undefined") return [];
  try {
    return JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY) ?? "[]") as LogEntry[];
  } catch {
    return [];
  }
}

export const logs = atom<LogEntry[]>(readLogs());

export function logEvent(source: string, message: string) {
  const next = [{ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, time: new Date().toLocaleTimeString(), source, message }, ...logs.get()].slice(0, 220);
  logs.set(next);
  globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearLogs() {
  logs.set([]);
  globalThis.localStorage?.removeItem(STORAGE_KEY);
}
