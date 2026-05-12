import { filesystem, type FsNode } from "../data/filesystem";
import { logEvent } from "./logs";
import { moveMetadata, touchCreated, touchModified } from "./metadata";

const STORAGE_KEY = "blairos.fs.v1";
export const FS_CHANGED_EVENT = "blairos:fs-changed";

let fsCache: FsNode | undefined;

function cloneNode(node: FsNode): FsNode {
  return { ...node, children: node.children?.map(cloneNode) };
}

function storage() {
  return typeof globalThis.localStorage === "undefined" ? undefined : globalThis.localStorage;
}

function fsRoot() {
  if (fsCache) return fsCache;
  const saved = storage()?.getItem(STORAGE_KEY);
  if (saved) {
    try {
      fsCache = JSON.parse(saved) as FsNode;
      migrateFs(fsCache);
      return fsCache;
    } catch {
      storage()?.removeItem(STORAGE_KEY);
    }
  }
  fsCache = cloneNode(filesystem);
  return fsCache;
}

function findIn(root: FsNode, path: string): FsNode | undefined {
  if (root.path === path) return root;
  for (const child of root.children ?? []) {
    const found = findIn(child, path);
    if (found) return found;
  }
  return undefined;
}

function migrateFs(root: FsNode) {
  let changed = false;
  ["/", "/Desktop", "/Home/blair", "/Home/blair/Documents", "/Applications", "/bin"].forEach((path) => {
    const current = findIn(root, path);
    const defaults = findIn(filesystem, path);
    if (!current?.children || !defaults?.children) return;
    defaults.children.forEach((node) => {
      const existing = current.children?.find((child) => child.path === node.path);
      if (!existing) {
        current.children?.push(cloneNode(node));
        changed = true;
      } else if (existing.appId && existing.appId === node.appId && existing.icon !== node.icon) {
        existing.icon = node.icon;
        changed = true;
      }
    });
  });
  const oldHomepage = findIn(root, "/Trash/old-homepage.html");
  if (oldHomepage) {
    oldHomepage.type = "link";
    oldHomepage.icon = "ph-file-html";
    oldHomepage.href = "blairos://Desktop/old-homepage.html";
    oldHomepage.body = "Recovered BlairOS v1 homepage.";
    oldHomepage.originalPath = "/Desktop/old-homepage.html";
    changed = true;
  }
  flattenFs(root).forEach((node) => {
    if (!/^readme\.(txt|md)$/i.test(node.name) || !node.body) return;
    const nextBody = node.body
      .replace(/everything here is static\.?(\s*)/gi, "$1")
      .replace(/this is a static site\.?(\s*)/gi, "$1")
      .replace(/static site\.?(\s*)/gi, "$1")
      .trim();
    if (nextBody !== node.body) {
      node.body = nextBody;
      changed = true;
    }
  });
  if (changed) storage()?.setItem(STORAGE_KEY, JSON.stringify(root));
}

function saveFs() {
  if (!fsCache) return;
  storage()?.setItem(STORAGE_KEY, JSON.stringify(fsCache));
  window.dispatchEvent(new CustomEvent(FS_CHANGED_EVENT));
}

function parentPath(path: string) {
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return `/${parts.join("/")}` || "/";
}

function baseName(path: string) {
  return path.split("/").filter(Boolean).at(-1) ?? "";
}

function canContain(node: FsNode) {
  return node.type === "folder" || node.type === "trash";
}

function iconFor(type: FsNode["type"]) {
  if (type === "folder") return "ph-folder";
  if (type === "trash") return "ph-trash";
  if (type === "program") return "ph-file-code";
  if (type === "link") return "ph-link-simple";
  return "ph-file-text";
}

function documentIconFor(path: string) {
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(path)) return "ph-image";
  if (/\.(sheet|csv)$/i.test(path)) return "ph-table";
  if (/\.html?$/i.test(path)) return "ph-file-html";
  if (/\.md$/i.test(path)) return "ph-file-md";
  return "ph-file-text";
}

function retarget(node: FsNode, nextPath: string): FsNode {
  const renamed = cloneNode(node);
  const rename = (current: FsNode, path: string) => {
    current.id = `user-${Date.now()}-${path.replace(/[^a-z0-9]+/gi, "-")}`;
    current.path = path;
    current.name = baseName(path) || current.name;
    current.children?.forEach((child) => rename(child, `${path}/${child.name}`));
  };
  rename(renamed, nextPath);
  return renamed;
}

function uniqueChildPath(folder: FsNode, name: string) {
  let candidate = `${folder.path === "/" ? "" : folder.path}/${name}`;
  let index = 2;
  while (findNode(candidate)) {
    candidate = `${folder.path === "/" ? "" : folder.path}/${name} ${index}`;
    index += 1;
  }
  return candidate;
}

function detachNode(path: string) {
  const normalized = normalizePath(path, "/");
  if (normalized === "/") return "cannot remove root";
  if (normalized === "/Trash") return "cannot remove Trash";
  const parent = findNode(parentPath(normalized));
  const index = parent?.children?.findIndex((node) => node.path === normalized) ?? -1;
  if (!parent?.children || index < 0) return `${normalized}: no such file or directory`;
  const [node] = parent.children.splice(index, 1);
  return node;
}

export function normalizePath(input: string, cwd = "/Home/blair") {
  const raw = input.trim() || cwd;
  const start = raw === "~" ? "/Home/blair" : raw.startsWith("~/") ? `/Home/blair/${raw.slice(2)}` : raw.startsWith("/") ? raw : `${cwd}/${raw}`;
  const parts = start.split("/").filter(Boolean);
  const out: string[] = [];

  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }

  return `/${out.join("/")}` || "/";
}

export function flattenFs(node: FsNode = fsRoot()): FsNode[] {
  return [node, ...(node.children ?? []).flatMap((child) => flattenFs(child))];
}

export function findNode(path: string) {
  const normalized = normalizePath(path, "/");
  return flattenFs().find((node) => node.path === normalized || node.path.toLowerCase() === normalized.toLowerCase());
}

export function listChildren(path: string) {
  const node = findNode(path);
  return node?.children ?? [];
}

export function desktopNodes() {
  return listChildren("/Desktop");
}

export function searchableNodes() {
  return flattenFs().filter((node) => node.path !== "/");
}

export function createNode(path: string, type: "folder" | "document", body = "") {
  const normalized = normalizePath(path, "/");
  if (normalized === "/") return `cannot create root`;
  if (findNode(normalized)) return `${normalized}: already exists`;
  const parent = findNode(parentPath(normalized));
  if (!parent || !canContain(parent)) return `${parentPath(normalized)}: not a folder`;
  parent.children ??= [];
  parent.children.push({
    id: `user-${type}-${Date.now()}-${baseName(normalized)}`,
    name: baseName(normalized),
    path: normalized,
    type,
    icon: type === "document" ? documentIconFor(normalized) : iconFor(type),
    ...(type === "document" ? { body } : { children: [] })
  });
  touchCreated(normalized);
  logEvent("filesystem", `created ${type} ${normalized}`);
  saveFs();
  return undefined;
}

export function installPackageArtifacts(name: string, appId?: string, icon = "ph-package") {
  const safeName = name.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  if (!safeName) return undefined;
  const title = `${safeName.charAt(0).toUpperCase()}${safeName.slice(1)}`;
  const apps = findNode("/Applications");
  const bin = findNode("/bin");
  if (!apps?.children || !bin?.children) return "/Applications or /bin not available";
  if (!findNode(`/Applications/${title}.app`)) {
    apps.children.push({
      id: `pkg-app-${safeName}`,
      name: `${title}.app`,
      path: `/Applications/${title}.app`,
      type: "app",
      icon,
      ...(appId ? { appId } : {})
    });
  }
  if (!findNode(`/bin/${safeName}`)) {
    bin.children.push({
      id: `pkg-bin-${safeName}`,
      name: safeName,
      path: `/bin/${safeName}`,
      type: "program",
      icon: "ph-file-code",
      body: `Executable program: ${safeName}`
    });
  }
  logEvent("packages", `installed artifacts for ${safeName}`);
  saveFs();
  return undefined;
}

export function removeNode(path: string) {
  const normalized = normalizePath(path, "/");
  const node = detachNode(normalized);
  if (typeof node === "string") return node;
  const trash = findNode("/Trash");
  if (!trash || !canContain(trash)) return "/Trash: not available";
  trash.children ??= [];
  const trashedPath = uniqueChildPath(trash, node.name);
  trash.children.push({ ...retarget(node, trashedPath), originalPath: normalized });
  moveMetadata(normalized, trashedPath);
  logEvent("filesystem", `moved ${normalized} to Trash`);
  saveFs();
  return undefined;
}

export function emptyTrash() {
  const trash = findNode("/Trash");
  if (!trash || !canContain(trash)) return "/Trash: not available";
  trash.children = [];
  logEvent("filesystem", "emptied Trash");
  saveFs();
  return undefined;
}

export function restoreNode(path: string) {
  const normalized = normalizePath(path, "/");
  const node = findNode(normalized);
  if (!node || !normalized.startsWith("/Trash/")) return `${normalized}: not in Trash`;
  const originalPath = node.originalPath || `/Home/blair/${node.name}`;
  const targetParentPath = findNode(parentPath(originalPath)) ? parentPath(originalPath) : "/Home/blair";
  const parent = findNode(targetParentPath);
  if (!parent || !canContain(parent)) return `${targetParentPath}: not a folder`;
  const detached = detachNode(normalized);
  if (typeof detached === "string") return detached;
  parent.children ??= [];
  const target = uniqueChildPath(parent, baseName(originalPath) || detached.name);
  const restored = retarget({ ...detached, originalPath: undefined }, target);
  parent.children.push(restored);
  moveMetadata(normalized, target);
  logEvent("filesystem", `restored ${normalized} to ${target}`);
  saveFs();
  return restored.path;
}

export function copyNode(sourcePath: string, destPath: string) {
  const source = findNode(sourcePath);
  if (!source) return `${sourcePath}: no such file or directory`;
  const dest = findNode(destPath);
  const targetPath = dest && canContain(dest) ? `${dest.path}/${source.name}` : normalizePath(destPath, "/");
  if (findNode(targetPath)) return `${targetPath}: already exists`;
  const parent = findNode(parentPath(targetPath));
  if (!parent || !canContain(parent)) return `${parentPath(targetPath)}: not a folder`;
  parent.children ??= [];
  parent.children.push(retarget(source, targetPath));
  touchCreated(targetPath);
  logEvent("filesystem", `copied ${source.path} to ${targetPath}`);
  saveFs();
  return undefined;
}

export function duplicateNode(path: string) {
  const source = findNode(path);
  if (!source) return `${path}: no such file or directory`;
  const parent = findNode(parentPath(source.path));
  if (!parent || !canContain(parent)) return `${parentPath(source.path)}: not a folder`;
  const target = uniqueChildPath(parent, `${source.name} copy`);
  parent.children ??= [];
  parent.children.push(retarget(source, target));
  touchCreated(target);
  logEvent("filesystem", `duplicated ${source.path} to ${target}`);
  saveFs();
  return target;
}

export function renameNode(path: string, nextName: string) {
  const source = findNode(path);
  if (!source) return `${path}: no such file or directory`;
  if (!nextName.trim() || nextName.includes("/")) return "invalid name";
  const parent = findNode(parentPath(source.path));
  if (!parent || !canContain(parent)) return `${parentPath(source.path)}: not a folder`;
  const target = `${parent.path === "/" ? "" : parent.path}/${nextName.trim()}`;
  if (findNode(target)) return `${target}: already exists`;
  const removed = detachNode(source.path);
  if (typeof removed === "string") return removed;
  parent.children ??= [];
  parent.children.push(retarget(removed, target));
  moveMetadata(source.path, target);
  touchModified(target);
  logEvent("filesystem", `renamed ${source.path} to ${target}`);
  saveFs();
  return target;
}

export function moveNode(sourcePath: string, destPath: string) {
  const source = findNode(sourcePath);
  if (!source) return `${sourcePath}: no such file or directory`;
  const dest = findNode(destPath);
  const targetPath = dest && canContain(dest) ? `${dest.path}/${source.name}` : normalizePath(destPath, "/");
  if (targetPath.startsWith(`${source.path}/`)) return "cannot move folder into itself";
  const parent = findNode(parentPath(targetPath));
  if (!parent || !canContain(parent)) return `${parentPath(targetPath)}: not a folder`;
  if (findNode(targetPath)) return `${targetPath}: already exists`;
  const removed = detachNode(source.path);
  if (typeof removed === "string") return removed;
  parent.children ??= [];
  parent.children.push(retarget(source, targetPath));
  moveMetadata(source.path, targetPath);
  touchModified(targetPath);
  logEvent("filesystem", `moved ${source.path} to ${targetPath}`);
  saveFs();
  return undefined;
}

export function writeDocument(path: string, body: string) {
  const node = findNode(path);
  if (!node) return `${path}: no such file`;
  if (node.type !== "document") return `${path}: not a text file`;
  node.body = body;
  touchModified(path);
  logEvent("filesystem", `wrote ${path}`);
  saveFs();
  return undefined;
}

export function resetFilesystem() {
  fsCache = cloneNode(filesystem);
  storage()?.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(FS_CHANGED_EVENT));
}
