import { atom } from "nanostores";

export type FileMetadata = {
  createdAt?: string;
  modifiedAt?: string;
  openedAt?: string;
  tags?: string[];
  favorite?: boolean;
  comment?: string;
};

const STORAGE_KEY = "blairos.file-meta.v1";

function readMeta() {
  if (typeof globalThis.localStorage === "undefined") return {};
  try {
    return JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, FileMetadata>;
  } catch {
    return {};
  }
}

export const fileMetadata = atom<Record<string, FileMetadata>>(readMeta());

function write(next: Record<string, FileMetadata>) {
  fileMetadata.set(next);
  globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function metadataFor(path: string) {
  return fileMetadata.get()[path] ?? {};
}

export function updateMetadata(path: string, patch: FileMetadata) {
  const current = fileMetadata.get();
  write({ ...current, [path]: { ...current[path], ...patch } });
}

export function touchCreated(path: string) {
  const now = new Date().toISOString();
  const current = metadataFor(path);
  updateMetadata(path, { createdAt: current.createdAt ?? now, modifiedAt: now });
}

export function touchModified(path: string) {
  updateMetadata(path, { modifiedAt: new Date().toISOString() });
}

export function touchOpened(path: string) {
  updateMetadata(path, { openedAt: new Date().toISOString() });
}

export function toggleFavorite(path: string) {
  const current = metadataFor(path);
  updateMetadata(path, { favorite: !current.favorite });
  return !current.favorite;
}

export function setTags(path: string, tags: string[]) {
  updateMetadata(path, { tags: tags.map((tag) => tag.trim()).filter(Boolean) });
}

export function setComment(path: string, comment: string) {
  updateMetadata(path, { comment });
}

export function moveMetadata(from: string, to: string) {
  const current = fileMetadata.get();
  const next = { ...current };
  Object.entries(current).forEach(([path, meta]) => {
    if (path === from || path.startsWith(`${from}/`)) {
      delete next[path];
      next[path.replace(from, to)] = meta;
    }
  });
  write(next);
}
