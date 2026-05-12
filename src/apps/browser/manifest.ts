import { bookmarks } from "../../os/data/bookmarks";
import { links } from "../../os/data/links";
import { append, bindButtonAction, el, icon, subtleButton } from "../../os/kernel/dom";
import type { AppManifest } from "../../os/kernel/types";

function normalizeBrowserUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "blairos://home";
  if (["old-homepage", "old-homepage.html", "/old-homepage.html", "blairos://old-homepage", "blairos://path/to/old-homepage.html", "blairos://desktop/old-homepage.html"].includes(trimmed.toLowerCase())) return "blairos://Desktop/old-homepage.html";
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (/^[a-z]+:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.includes(".") && !trimmed.includes(" ")) return `https://${trimmed}`;
  return trimmed;
}

function browserTitleForUrl(url: string) {
  if (url === "blairos://home") return "Browser - Home";
  const builtInTitles: Record<string, string> = {
    "blairos://coffee": "Browser - Caffeination Console",
    "blairos://matrix": "Browser - Matrix",
    "blairos://about-root": "Browser - Root Access",
    "blairos://Desktop/old-homepage.html": "Browser - Old Homepage",
    "blairos://weekend-sprint": "Browser - Weekend Project Tokens",
    "blairos://rapid-systemisation": "Browser - Rapid Systemisation",
    "blairos://sublight": "Browser - Engage Sublight",
    "blairos://proof-of-work": "Browser - Proof Beats Badge",
    "blairos://broadband-ai": "Browser - Broadband AI Era",
    "blairos://chat-is-not-the-workflow": "Browser - Chat Box Gravity Field"
  };
  if (builtInTitles[url]) return builtInTitles[url];
  const link = links.find((item) => item.href === url || item.key === url.replace("blairos://", ""));
  if (link) return `Browser - ${link.label}`;
  try {
    const parsed = new URL(url, window.location.origin);
    return `Browser - ${parsed.pathname === "/" ? parsed.hostname : parsed.pathname.split("/").filter(Boolean).at(-1) || parsed.hostname}`;
  } catch {
    return `Browser - ${url}`;
  }
}

function frameBlockedLikely(url: string) {
  try {
    const host = new URL(url, window.location.origin).hostname.replace(/^www\./, "");
    return [
      "github.com",
      "linkedin.com",
      "x.com",
      "twitter.com",
      "facebook.com",
      "instagram.com",
      "youtube.com",
      "substack.com",
      "myworkdayjobs.com"
    ].some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
  } catch {
    return false;
  }
}

export const browserManifest: AppManifest = {
  id: "browser",
  name: "Browser",
  icon: "ph-compass",
  defaultSize: { width: 900, height: 620 },
  render: (context) => {
    let currentUrl = normalizeBrowserUrl(String(context.process.data?.url || "blairos://home"));
    let history = [currentUrl];
    let historyIndex = 0;
    let currentFrame: HTMLIFrameElement | null = null;
    const root = el("section", "flex h-full flex-col bg-slate-950/30 text-white");
    const bar = el("div", "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-white/10 p-3 max-sm:gap-1.5 max-sm:p-2");
    const nav = el("div", "flex min-w-0 items-center gap-1");
    const input = el("input", "min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-2 font-mono text-sm text-white outline-none focus:border-cyan-300/60 max-sm:px-2 max-sm:text-xs") as HTMLInputElement;
    input.value = currentUrl;
    input.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      requestAnimationFrame(() => input.focus({ preventScroll: true }));
    });
    input.addEventListener("click", () => input.focus({ preventScroll: true }));
    const actions = el("div", "flex min-w-0 items-center gap-2 max-sm:gap-1");
    const controlClass = "grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/8 text-white/75 transition hover:border-white/25 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35 max-sm:h-8 max-sm:w-8 max-sm:rounded-xl";
    const back = el("button", controlClass, { type: "button", title: "Back" }) as HTMLButtonElement;
    const forward = el("button", controlClass, { type: "button", title: "Forward" }) as HTMLButtonElement;
    const reload = el("button", controlClass, { type: "button", title: "Reload" }) as HTMLButtonElement;
    const home = el("button", controlClass, { type: "button", title: "Home" }) as HTMLButtonElement;
    const go = el("button", `${subtleButton} shrink-0 max-sm:px-2 max-sm:py-2 max-sm:text-xs`, { text: "Go", type: "button" });
    append(back, [icon("ph-arrow-left", "text-lg")]);
    append(forward, [icon("ph-arrow-right", "text-lg")]);
    append(reload, [icon("ph-arrow-clockwise", "text-lg")]);
    append(home, [icon("ph-house", "text-lg")]);
    const content = el("div", "min-h-0 flex-1 overflow-hidden");

    function renderEasterPage(url: string) {
      content.className = "min-h-0 flex-1 overflow-auto";
      const host = url.replace("blairos://", "");
      const page = el("div", "grid min-h-full content-center gap-5 p-6 text-center");
      const notes: Record<string, { kicker: string; title: string; body: string; path?: string }> = {
        "weekend-sprint": {
          kicker: "sprint report",
          title: "Weekend Project Tokens",
          body: "Workslop diverted. Learning by building resumed. Proof-of-work residue detected in filesystem.",
          path: "/Field Notes/weekend-sprint-report.md"
        },
        "rapid-systemisation": {
          kicker: "operating thesis",
          title: "Rapid Systemisation",
          body: "AI usage is not capability. Capability appears when task patterns become explicit, repeatable, and improvable.",
          path: "/Field Notes/rapid-systemisation.md"
        },
        "sublight": {
          kicker: "transition engine",
          title: "Engage Sublight",
          body: "Before lightspeed, make systems work in the flow of real jobs. Chat is interface. Workflow is adoption.",
          path: "/Field Notes/sublight-engines.md"
        },
        "proof-of-work": {
          kicker: "credential daemon",
          title: "Proof Beats Badge",
          body: "Verifiable project evidence found. Certificate-shaped confetti suppressed until useful work is present.",
          path: "/Field Notes/weekend-sprint-report.md"
        },
        "broadband-ai": {
          kicker: "network mode",
          title: "Broadband AI Era",
          body: "Dial-up noises archived. Token throughput rising. New bottleneck: turning speed into durable systems."
        },
        "chat-is-not-the-workflow": {
          kicker: "adoption check",
          title: "Chat Box Gravity Field",
          body: "Chat unlocks capability, then plateaus. Real uplift needs tools embedded in forms, jobs, decisions, and handoffs.",
          path: "/Field Notes/sublight-engines.md"
        }
      };
      if (host === "coffee") {
        const last = localStorage.getItem("blairos.caffeinated");
        append(page, [
          el("div", "mx-auto grid h-24 w-24 place-items-center rounded-[2rem] border border-amber-200/30 bg-amber-300/15 font-mono text-3xl font-black", { text: "COF" }),
          el("h2", "text-5xl font-black tracking-[-0.08em]", { text: "Caffeination Console" }),
          el("p", "mx-auto max-w-xl text-white/65", { text: last ? `Last brew: ${new Date(last).toLocaleString()}. Sleep prevention remains morally active.` : "No brew logged yet. Try coffee in Terminal." })
        ]);
        return page;
      }
      if (host === "matrix") {
        const rain = Array.from({ length: 18 }, () => Array.from({ length: 42 }, () => (Math.random() > 0.66 ? "01<>AI"[Math.floor(Math.random() * 6)] : " ")).join("")).join("\n");
        append(page, [el("pre", "mx-auto rounded-3xl border border-emerald-300/20 bg-black/70 p-5 text-left font-mono text-xs leading-4 text-emerald-300 shadow-2xl shadow-emerald-950/40", { text: rain }), el("p", "font-mono text-emerald-100", { text: "follow the white cursor" })]);
        return page;
      }
      if (host === "about-root") {
        append(page, [
          el("h2", "text-5xl font-black tracking-[-0.08em]", { text: "Root Access" }),
          el("p", "mx-auto max-w-xl text-white/65", { text: "There is no password prompt because Blair is already root. The machine just likes ceremony." }),
          el("button", `${subtleButton} mx-auto`, { type: "button", text: "Open secret note" })
        ]);
        bindButtonAction(page.lastElementChild as HTMLButtonElement, () => context.launchApp("preview", { path: "/System/.secrets/README.md" }));
        return page;
      }
      const note = notes[host];
      if (note) {
        append(page, [
          el("p", "font-mono text-xs uppercase tracking-[0.45em] text-cyan-200", { text: note.kicker }),
          el("h2", "mx-auto max-w-2xl text-5xl font-black tracking-[-0.08em]", { text: note.title }),
          el("p", "mx-auto max-w-xl text-white/65", { text: note.body })
        ]);
        if (note.path) {
          const openNote = el("button", `${subtleButton} mx-auto`, { type: "button", text: "Open field note" });
          bindButtonAction(openNote, () => context.launchApp("preview", { path: note.path }));
          page.append(openNote);
        }
        return page;
      }
      return undefined;
    }

    function updateControls() {
      back.disabled = historyIndex <= 0;
      forward.disabled = historyIndex >= history.length - 1;
    }

    function navigate(rawUrl: string, push = true) {
      const url = normalizeBrowserUrl(rawUrl);
      const previousUrl = currentUrl;
      const link = links.find((item) => item.href === url || item.key === url.replace("blairos://", ""));
      const href = link?.href || url;
      if ((href.startsWith("http") || href.startsWith("/")) && frameBlockedLikely(href)) {
        window.open(href, "_blank", "noopener,noreferrer");
        input.value = currentUrl;
        context.notify(`Opened ${href.replace(/^https?:\/\//, "")} in a new tab`);
        return;
      }
      if (push && url !== currentUrl) {
        history = [...history.slice(0, historyIndex + 1), url];
        historyIndex = history.length - 1;
      }
      renderPage(url, previousUrl);
    }

    function renderPage(url: string, fallbackUrl = "blairos://home") {
      currentUrl = url;
      currentFrame = null;
      input.value = url;
      context.updateTitle(browserTitleForUrl(url));
      updateControls();
      content.className = url === "blairos://home" ? "min-h-0 flex-1 overflow-auto" : "min-h-0 flex-1 overflow-hidden";
      content.replaceChildren();
      if (url === "blairos://home") {
        const grid = el("div", "mx-auto grid w-full max-w-5xl min-w-0 gap-4 overflow-hidden p-5 max-sm:p-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]");
        const hero = el("div", "min-w-0 rounded-[30px] border border-white/15 bg-gradient-to-br from-cyan-400/15 to-fuchsia-400/10 p-6 max-sm:p-4");
        append(hero, [
          el("div", "font-mono text-xs uppercase tracking-[0.35em] text-cyan-200", { text: "internet of blair" }),
          el("h2", "mt-3 break-words text-4xl font-black tracking-[-0.08em] max-sm:text-3xl", { text: "Where do you want to go?" }),
          el("p", "mt-3 text-white/70", { text: "Type an address above, pick a bookmark, or head home." })
        ]);
        const bookmarkList = el("div", "grid min-w-0 gap-2");
        bookmarks.forEach((bookmark) => {
          const item = el("button", `${subtleButton} grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,auto)] gap-3 max-sm:grid-cols-1`, { type: "button" });
          append(item, [el("span", "min-w-0 truncate font-semibold", { text: bookmark.title }), el("span", "min-w-0 truncate font-mono text-xs text-white/40", { text: bookmark.url.replace(/^https?:\/\//, "") })]);
          bindButtonAction(item, () => navigate(bookmark.url));
          bookmarkList.append(item);
        });
        append(grid, [hero, bookmarkList]);
        content.append(grid);
        return;
      }

      const easterPage = url.startsWith("blairos://") ? renderEasterPage(url) : undefined;
      if (easterPage) {
        content.append(easterPage);
        return;
      }

      if (url === "blairos://Desktop/old-homepage.html") {
        const frame = el("iframe", "h-full w-full border-0 bg-white", {
          src: "/old-homepage.html",
          title: "Old Homepage",
          referrerpolicy: "no-referrer-when-downgrade"
        }) as HTMLIFrameElement;
        frame.addEventListener("load", () => context.updateTitle("Browser - Old Homepage"));
        currentFrame = frame;
        content.append(frame);
        return;
      }

      const link = links.find((item) => item.href === url || item.key === url.replace("blairos://", ""));
      if (link || url.startsWith("http") || url.startsWith("/")) {
        const href = link?.href || url;
        let openedNewTab = false;
        const openInNewTab = () => {
          if (openedNewTab) return;
          openedNewTab = true;
          window.open(href, "_blank", "noopener,noreferrer");
          context.notify(`Opened ${href.replace(/^https?:\/\//, "")} in a new tab`);
          if (fallbackUrl !== url) {
            if (history[historyIndex] === url) {
              history = history.filter((_, index) => index !== historyIndex);
              historyIndex = Math.max(0, historyIndex - 1);
            }
            renderPage(fallbackUrl, fallbackUrl);
          }
        };

        if (frameBlockedLikely(href)) {
          openInNewTab();
          return;
        }

        const frame = el("iframe", "h-full w-full border-0 bg-white", {
          src: href,
          title: link?.label || href,
          referrerpolicy: "no-referrer-when-downgrade"
        }) as HTMLIFrameElement;
        frame.addEventListener("error", openInNewTab);
        frame.addEventListener("load", () => {
          try {
            const title = frame.contentDocument?.title || frame.contentWindow?.document.title;
            if (title) context.updateTitle(`Browser - ${title}`);
          } catch {
            context.updateTitle(browserTitleForUrl(url));
          }
        });
        currentFrame = frame;
        content.append(frame);
        return;
      }

      content.append(el("p", "p-5 font-mono text-sm text-white/55", { text: `cannot resolve ${url}` }));
    }

    bindButtonAction(back, () => {
      if (historyIndex <= 0) return;
      historyIndex -= 1;
      renderPage(history[historyIndex]);
    });
    bindButtonAction(forward, () => {
      if (historyIndex >= history.length - 1) return;
      historyIndex += 1;
      renderPage(history[historyIndex]);
    });
    bindButtonAction(reload, () => {
      if (currentFrame) currentFrame.src = currentFrame.src;
      else renderPage(currentUrl);
    });
    bindButtonAction(home, () => navigate("blairos://home"));
    bindButtonAction(go, () => navigate(input.value));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") navigate(input.value);
    });
    append(nav, [back, forward, reload, home]);
    append(actions, [go]);
    append(bar, [nav, input, actions]);
    append(root, [bar, content]);
    renderPage(currentUrl);
    return root;
  }
};
