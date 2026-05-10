import { atom } from "nanostores";

export type NotificationRecord = {
  id: string;
  time: string;
  message: string;
  read?: boolean;
};

const STORAGE_KEY = "blairos.notifications.v1";

function readNotifications() {
  if (typeof globalThis.localStorage === "undefined") return [];
  try {
    return JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY) ?? "[]") as NotificationRecord[];
  } catch {
    return [];
  }
}

export const notifications = atom<NotificationRecord[]>(readNotifications());

export function addNotification(message: string) {
  const next = [{ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, time: new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit" }).format(new Date()), message }, ...notifications.get()].slice(0, 80);
  notifications.set(next);
  globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearNotifications() {
  notifications.set([]);
  globalThis.localStorage?.removeItem(STORAGE_KEY);
}
