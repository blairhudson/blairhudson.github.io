import type { FsNode } from "../data/filesystem";

export type AppId =
  | "terminal"
  | "browser"
  | "files"
  | "code"
  | "editor"
  | "trash"
  | "settings"
  | "about"
  | "activityMonitor"
  | "systemProfiler"
  | "console"
  | "preview"
  | "notes"
  | "diskUtility"
  | "networkUtility"
  | "calculator"
  | "mail"
  | "radio"
  | "git"
  | "blairDrive"
  | "packageManager"
  | "paint"
  | "sheets";

export type ProcessRecord = {
  id: string;
  appId: AppId;
  title: string;
  icon: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
  data?: Record<string, unknown>;
};

export type AppContext = {
  process: ProcessRecord;
  launchApp: (appId: AppId, data?: Record<string, unknown>) => void;
  closeProcess: (processId: string) => void;
  updateTitle: (title: string) => void;
  openExternal: (href: string) => void;
  openNode: (node: FsNode) => void;
  notify: (message: string) => void;
};

export type AppManifest = {
  id: AppId;
  name: string;
  icon: string;
  defaultSize: { width: number; height: number };
  render: (context: AppContext) => HTMLElement;
};

export type CommandContext = {
  cwd: string;
  setCwd: (path: string) => void;
  launchApp: (appId: AppId, data?: Record<string, unknown>) => void;
  openExternal: (href: string) => void;
  clear: () => void;
  startNano?: (path?: string) => void;
};

export type CommandResult = {
  lines?: string[];
};

export type Program = {
  name: string;
  help: string;
  run: (args: string[], context: CommandContext) => CommandResult | Promise<CommandResult>;
};
