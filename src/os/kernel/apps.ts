import { aboutManifest } from "../../apps/about/manifest";
import { activityMonitorManifest } from "../../apps/activity-monitor/manifest";
import { browserManifest } from "../../apps/browser/manifest";
import { calculatorManifest } from "../../apps/calculator/manifest";
import { consoleManifest } from "../../apps/console/manifest";
import { codeManifest } from "../../apps/code/manifest";
import { diskUtilityManifest } from "../../apps/disk-utility/manifest";
import { editorManifest } from "../../apps/editor/manifest";
import { filesManifest } from "../../apps/files/manifest";
import { blairDriveManifest } from "../../apps/blair-drive/manifest";
import { gitManifest } from "../../apps/git/manifest";
import { mailManifest } from "../../apps/mail/manifest";
import { networkUtilityManifest } from "../../apps/network-utility/manifest";
import { notesManifest } from "../../apps/notes/manifest";
import { packageManagerManifest } from "../../apps/package-manager/manifest";
import { paintManifest } from "../../apps/paint/manifest";
import { previewManifest } from "../../apps/preview/manifest";
import { radioManifest } from "../../apps/radio/manifest";
import { settingsManifest } from "../../apps/settings/manifest";
import { sheetsManifest } from "../../apps/sheets/manifest";
import { systemProfilerManifest } from "../../apps/system-profiler/manifest";
import { terminalManifest } from "../../apps/terminal/manifest";
import { trashManifest } from "../../apps/trash/manifest";
import type { AppId, AppManifest } from "./types";

export const appManifests = [
  terminalManifest,
  browserManifest,
  filesManifest,
  codeManifest,
  editorManifest,
  notesManifest,
  previewManifest,
  activityMonitorManifest,
  consoleManifest,
  systemProfilerManifest,
  diskUtilityManifest,
  networkUtilityManifest,
  calculatorManifest,
  mailManifest,
  radioManifest,
  gitManifest,
  blairDriveManifest,
  packageManagerManifest,
  paintManifest,
  sheetsManifest,
  trashManifest,
  settingsManifest,
  aboutManifest
];

export const appRegistry = Object.fromEntries(appManifests.map((app) => [app.id, app])) as Record<AppId, AppManifest>;
