import type { AppId } from "./types";

const RECENTS_KEY = "blairos.recents.v1";
export const RECENTS_CHANGED_EVENT = "blairos:recents-changed";

export type RecentItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  kind: "app" | "file" | "url" | "command";
  appId?: AppId;
  path?: string;
  url?: string;
  command?: string;
  at: number;
};

function read(): RecentItem[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]") as RecentItem[];
  } catch {
    return [];
  }
}

function write(items: RecentItem[]) {
  localStorage.setItem(RECENTS_KEY, JSON.stringify(items.slice(0, 30)));
  window.dispatchEvent(new CustomEvent(RECENTS_CHANGED_EVENT));
}

export function getRecentItems() {
  return read().sort((a, b) => b.at - a.at);
}

export function addRecentItem(item: Omit<RecentItem, "at">) {
  write([{ ...item, at: Date.now() }, ...read().filter((recent) => recent.id !== item.id)]);
}

export function clearRecentItems() {
  localStorage.removeItem(RECENTS_KEY);
  window.dispatchEvent(new CustomEvent(RECENTS_CHANGED_EVENT));
}
