import { Terminal } from "@xterm/xterm";
import { append, el } from "../../os/kernel/dom";
import { commandNames, runCommand, tokenize } from "../../os/kernel/command-runner";
import type { AppManifest } from "../../os/kernel/types";
import { appManifests } from "../../os/kernel/apps";
import { createNode, findNode, flattenFs, normalizePath, writeDocument } from "../../os/kernel/filesystem";

const seededHistory = [
  "open sbx",
  "fortune",
  "matrix",
  "env | grep OPENAI",
  "curl https://blairhudson.com/sbx-agents/"
];

type NanoSession = {
  path: string;
  lines: string[];
  row: number;
  col: number;
  message: string;
  dirty: boolean;
};

function readHistory() {
  try {
    const history = JSON.parse(localStorage.getItem("blairos.history") ?? "[]") as string[];
    const merged = [...history, ...seededHistory.filter((command) => !history.includes(command))];
    localStorage.setItem("blairos.history", JSON.stringify(merged.slice(-99)));
    return merged.slice(-99);
  } catch {
    return seededHistory;
  }
}

export const terminalManifest: AppManifest = {
  id: "terminal",
  name: "Terminal",
  icon: "ph-terminal-window",
  defaultSize: { width: 760, height: 520 },
  render: (context) => {
    let cwd = "/Home/blair";
    let input = "";
    let history = readHistory();
    let historyIndex = history.length;
    let nanoSession: NanoSession | undefined;
    let matrixTimer: number | undefined;
    let busy = false;
    const root = el("section", "absolute inset-0 min-h-0 bg-black/70 font-mono text-sm text-left [text-align:left] [text-justify:none]");
    const mount = el("div", "h-full min-h-0 overflow-hidden text-left [text-align:left] [text-justify:none]");
    append(root, [mount]);
    const term = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: "JetBrains Mono, ui-monospace, monospace",
      fontSize: 13,
      letterSpacing: 0,
      lineHeight: 1.25,
      theme: { background: "#02040a", foreground: "#d7fbff", cursor: "#80f7ff", green: "#b7ff7a" }
    });
    const keepBottomVisible = () => {
      const scroll = () => {
        term.scrollToBottom();
        const viewport = term.element?.querySelector(".xterm-viewport") as HTMLElement | null;
        if (viewport) viewport.scrollTop = viewport.scrollHeight;
      };
      scroll();
      queueMicrotask(scroll);
      window.setTimeout(scroll, 0);
      requestAnimationFrame(scroll);
      requestAnimationFrame(() => requestAnimationFrame(scroll));
    };
    const fitTerminal = () => {
      const rect = mount.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const sampleRow = term.element?.querySelector(".xterm-rows > div") as HTMLElement | null;
      const rowHeight = sampleRow?.getBoundingClientRect().height || 18.5;
      const cols = Math.max(28, Math.floor((rect.width - 12) / 7.9));
      const rows = Math.max(6, Math.floor((rect.height - 8) / rowHeight));
      term.resize(cols, rows);
      requestAnimationFrame(() => {
        const screen = term.element?.querySelector(".xterm-screen") as HTMLElement | null;
        const screenHeight = screen?.getBoundingClientRect().height ?? 0;
        const mountHeight = mount.getBoundingClientRect().height;
        if (!screenHeight || !mountHeight) return;
        const overflow = screenHeight - mountHeight;
        const spare = mountHeight - screenHeight;
        if (overflow > 1) term.resize(cols, Math.max(6, term.rows - Math.ceil(overflow / rowHeight)));
        else if (spare > rowHeight + 2) term.resize(cols, term.rows + Math.floor((spare - 2) / rowHeight));
        keepBottomVisible();
      });
      keepBottomVisible();
    };
    const writeVisible = (data: string) => term.write(data, keepBottomVisible);
    const writelnVisible = (data: string) => term.writeln(data, keepBottomVisible);

    const prompt = () => {
      writeVisible(`\x1b[36mblair\x1b[0m:${cwd}$ `);
    };
    const writeLines = (lines: string[]) => {
      lines.forEach((line) => writelnVisible(line));
      keepBottomVisible();
    };
    const redrawInput = (next: string) => {
      writeVisible(`\r\x1b[2K\x1b[36mblair\x1b[0m:${cwd}$ ${next}`);
      input = next;
      keepBottomVisible();
    };
    const complete = () => {
      const parts = tokenize(input);
      const last = parts.at(-1) ?? "";
      const prefix = input.endsWith(" ") ? "" : last;
      const before = input.endsWith(" ") ? input : input.slice(0, input.length - prefix.length);
      const commandMode = parts.length <= 1 && !input.endsWith(" ");
      const candidates = commandMode
        ? [...commandNames(), ...appManifests.map((app) => app.name.toLowerCase())]
        : flattenFs().map((node) => node.path).filter((path) => path.startsWith(prefix.startsWith("/") ? prefix : normalizePath(prefix, cwd)));
      const matches = candidates.filter((candidate) => candidate.toLowerCase().startsWith((commandMode ? prefix : normalizePath(prefix || ".", cwd)).toLowerCase()));
      if (matches.length === 1) redrawInput(`${before}${matches[0]}${commandMode ? " " : ""}`);
      else if (matches.length > 1) {
        writeVisible("\r\n");
        writeLines(matches.slice(0, 12));
        writeVisible(`\x1b[36mblair\x1b[0m:${cwd}$ ${input}`);
      }
    };
    const drawNano = () => {
      if (!nanoSession) return;
      const session = nanoSession;
      writeVisible("\x1b[2J\x1b[H");
      writelnVisible(`GNU nano 8.2   ${session.path}${session.dirty ? " *" : ""}`);
      writelnVisible("\x1b[2mCtrl+O Save   Ctrl+X Exit   Ctrl+K Cut line   arrows move\x1b[0m");
      writelnVisible("");
      session.lines.forEach((line) => writelnVisible(line || " "));
      writelnVisible("");
      writelnVisible(`\x1b[7m ${session.message || "Editing"} \x1b[0m`);
      writeVisible(`\x1b[${session.row + 4};${session.col + 1}H`);
      keepBottomVisible();
    };
    const saveNano = () => {
      if (!nanoSession) return;
      const body = nanoSession.lines.join("\n");
      const existing = findNode(nanoSession.path);
      const error = existing ? writeDocument(nanoSession.path, body) : createNode(nanoSession.path, "document", body);
      nanoSession.message = error ? `Write failed: ${error}` : `Wrote ${nanoSession.path}`;
      nanoSession.dirty = Boolean(error);
      drawNano();
    };
    const closeNano = () => {
      nanoSession = undefined;
      term.clear();
      writelnVisible("nano closed");
      writeVisible(`\x1b[36mblair\x1b[0m:${cwd}$ ${input}`);
      keepBottomVisible();
    };
    const stopMatrix = () => {
      if (matrixTimer) window.clearInterval(matrixTimer);
      matrixTimer = undefined;
      term.clear();
      writelnVisible("matrix closed");
      writeVisible(`\x1b[36mblair\x1b[0m:${cwd}$ `);
      keepBottomVisible();
    };
    const startMatrix = () => {
      const glyphs = "01アイウエオカキクケコサシスセソAI<>[]{}$#";
      const draw = () => {
        writeVisible("\x1b[2J\x1b[H\x1b[32m");
        for (let row = 0; row < term.rows - 1; row += 1) {
          let line = "";
          for (let col = 0; col < term.cols; col += 1) line += Math.random() > 0.72 ? glyphs[Math.floor(Math.random() * glyphs.length)] : " ";
          writelnVisible(line);
        }
        writeVisible("\x1b[0m\x1b[7m press any key to exit matrix \x1b[0m");
        keepBottomVisible();
      };
      draw();
      matrixTimer = window.setInterval(draw, 95);
    };
    const startNano = (target = "untitled.txt") => {
      const path = normalizePath(target, cwd);
      const node = findNode(path);
      const body = node?.type === "document" ? node.body ?? "" : "";
      nanoSession = { path, lines: body.split("\n"), row: 0, col: 0, message: node && node.type !== "document" ? `${path}: new buffer` : "New buffer", dirty: false };
      if (!nanoSession.lines.length) nanoSession.lines = [""];
      drawNano();
    };
    const handleNanoInput = (data: string) => {
      if (!nanoSession) return;
      const session = nanoSession;
      const line = session.lines[session.row] ?? "";
      if (data === "\x18") return closeNano();
      if (data === "\x0f") return saveNano();
      if (data === "\x0b") {
        session.lines.splice(session.row, 1);
        if (!session.lines.length) session.lines.push("");
        session.row = Math.min(session.row, session.lines.length - 1);
        session.col = Math.min(session.col, session.lines[session.row]?.length ?? 0);
        session.dirty = true;
        session.message = "Cut line";
      } else if (data === "\x1b[A") {
        session.row = Math.max(0, session.row - 1);
        session.col = Math.min(session.col, session.lines[session.row]?.length ?? 0);
      } else if (data === "\x1b[B") {
        session.row = Math.min(session.lines.length - 1, session.row + 1);
        session.col = Math.min(session.col, session.lines[session.row]?.length ?? 0);
      } else if (data === "\x1b[C") {
        session.col = Math.min(line.length, session.col + 1);
      } else if (data === "\x1b[D") {
        session.col = Math.max(0, session.col - 1);
      } else if (data === "\r") {
        session.lines[session.row] = line.slice(0, session.col);
        session.lines.splice(session.row + 1, 0, line.slice(session.col));
        session.row += 1;
        session.col = 0;
        session.dirty = true;
      } else if (data === "\u007f") {
        if (session.col > 0) {
          session.lines[session.row] = `${line.slice(0, session.col - 1)}${line.slice(session.col)}`;
          session.col -= 1;
          session.dirty = true;
        } else if (session.row > 0) {
          const previous = session.lines[session.row - 1] ?? "";
          session.lines[session.row - 1] = `${previous}${line}`;
          session.lines.splice(session.row, 1);
          session.row -= 1;
          session.col = previous.length;
          session.dirty = true;
        }
      } else if (data === "\t") {
        session.lines[session.row] = `${line.slice(0, session.col)}  ${line.slice(session.col)}`;
        session.col += 2;
        session.dirty = true;
      } else if (!data.startsWith("\x1b") && data.charCodeAt(0) >= 32) {
        session.lines[session.row] = `${line.slice(0, session.col)}${data}${line.slice(session.col)}`;
        session.col += data.length;
        session.dirty = true;
      }
      drawNano();
    };

    queueMicrotask(() => {
      term.open(mount);
      fitTerminal();
      writelnVisible("BlairOS v2 terminal. type 'help'.");
      writeVisible(`\x1b[36mblair\x1b[0m:${cwd}$ `);
      term.focus();
      keepBottomVisible();
      requestAnimationFrame(fitTerminal);
    });
    new ResizeObserver(fitTerminal).observe(mount);

    term.onData(async (data) => {
      if (matrixTimer) return stopMatrix();
      if (nanoSession) {
        handleNanoInput(data);
        return;
      }
      if (busy) return;
      const code = data.charCodeAt(0);
      if (data === "\t") {
        complete();
      } else if (data === "\r") {
        writeVisible("\r\n");
        const command = input;
        input = "";
        if (command.trim().toLowerCase() === "matrix") {
          startMatrix();
          return;
        }
        historyIndex = history.length;
        busy = true;
        try {
          const lines = await runCommand(command, {
            cwd,
            setCwd: (next) => {
              cwd = next;
            },
            launchApp: context.launchApp,
            openExternal: context.openExternal,
            clear: () => term.clear(),
            startNano
          });
          history = readHistory();
          historyIndex = history.length;
          writeLines(lines);
        } catch (error) {
          writeLines([error instanceof Error ? error.message : String(error)]);
        } finally {
          busy = false;
          prompt();
        }
      } else if (data === "\x1b[A") {
        if (history.length) {
          historyIndex = Math.max(0, historyIndex - 1);
          redrawInput(history[historyIndex] ?? "");
        }
      } else if (data === "\x1b[B") {
        if (history.length) {
          historyIndex = Math.min(history.length, historyIndex + 1);
          redrawInput(history[historyIndex] ?? "");
        }
      } else if (data === "\u007f") {
        if (input.length) {
          input = input.slice(0, -1);
          writeVisible("\b \b");
        }
      } else if (code >= 32) {
        input += data;
        writeVisible(data);
        }
    });

    return root;
  }
};
