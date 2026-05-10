import { links } from "./links";

export const bookmarks = [
  { title: "BlairOS Home", url: "blairos://home", summary: "System portal, apps, files, and current signal." },
  ...links.map((link) => ({ title: link.label, url: link.href, summary: link.subtitle }))
];
