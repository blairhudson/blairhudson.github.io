import { installPackageArtifacts } from "./filesystem";

const PACKAGE_STORAGE_KEY = "blairos.packages.v1";
export const PACKAGES_CHANGED_EVENT = "blairos:packages-changed";

export type PackageRecord = {
  name: string;
  manager: "apt" | "brew";
  installedAt: string;
};

function storage() {
  return typeof globalThis.localStorage === "undefined" ? undefined : globalThis.localStorage;
}

export function installedPackages() {
  try {
    const packages = JSON.parse(storage()?.getItem(PACKAGE_STORAGE_KEY) ?? "[]") as PackageRecord[];
    packages.forEach((pkg) => installPackageArtifacts(pkg.name, pkg.name === "paint" ? "paint" : undefined, pkg.name === "paint" ? "ph-paint-brush" : "ph-package"));
    return packages;
  } catch {
    return [];
  }
}

export function installPackage(name: string, manager: PackageRecord["manager"]) {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return undefined;
  const artifactError = installPackageArtifacts(normalized, normalized === "paint" ? "paint" : undefined, normalized === "paint" ? "ph-paint-brush" : "ph-package");
  if (artifactError) return undefined;
  const packages = installedPackages().filter((pkg) => pkg.name !== normalized || pkg.manager !== manager);
  packages.push({ name: normalized, manager, installedAt: new Date().toISOString() });
  storage()?.setItem(PACKAGE_STORAGE_KEY, JSON.stringify(packages));
  window.dispatchEvent(new CustomEvent(PACKAGES_CHANGED_EVENT));
  return packages.at(-1);
}
