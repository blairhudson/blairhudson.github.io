import { append, button, el } from "../../os/kernel/dom";
import type { AppManifest } from "../../os/kernel/types";

type Tool = "ping" | "trace" | "dig" | "whois";

const HISTORY_KEY = "blairos.network.history.v1";

function readHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function writeHistory(history: string[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 12)));
}

export const networkUtilityManifest: AppManifest = {
  id: "networkUtility",
  name: "Network Utility",
  icon: "ph-wifi-high",
  defaultSize: { width: 780, height: 560 },
  render: () => {
    let tool: Tool = "ping";
    let history = readHistory();
    const root = el("section", "grid h-full grid-rows-[auto_auto_1fr] gap-4 p-5 text-white");
    const stats = el("div", "grid gap-3 sm:grid-cols-4");
    const input = el("input", "min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 font-mono text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/60", { value: history[0] ?? "blairhudson.com", placeholder: "host or domain" }) as HTMLInputElement;
    const tabs = el("div", "flex flex-wrap gap-2");
    const output = el("pre", "m-0 overflow-auto rounded-3xl border border-white/10 bg-black/35 p-4 font-mono text-sm leading-6 text-cyan-100 whitespace-pre-wrap");
    const historyList = el("div", "flex flex-wrap gap-2");

    function stat(label: string, value: string) {
      return append(el("div", "rounded-2xl border border-white/10 bg-white/5 p-3"), [el("p", "text-xs uppercase tracking-widest text-white/40", { text: label }), el("p", "mt-1 font-mono text-xl font-black text-cyan-100", { text: value })]);
    }

    function linesFor(mode: Tool, host: string) {
      const hash = [...host].reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const ms = (base: number, index = 0) => (base + ((hash + index * 7) % 13) / 10).toFixed(1);
      const records: Record<Tool, string[]> = {
        ping: [`PING ${host} (${hash % 2 ? "76.76.21.21" : "104.21.16.1"})`, ...[0, 1, 2, 3].map((seq) => `64 bytes from ${host}: icmp_seq=${seq} ttl=${54 + (seq % 3)} time=${ms(16, seq)} ms`), "---", "4 packets transmitted, 4 received, 0.0% packet loss"],
        trace: ["traceroute to " + host, `1  blairos.gateway  ${ms(1)} ms`, `2  syd-edge.net  ${ms(7)} ms`, `3  ap-southeast.peer  ${ms(13)} ms`, `4  ${host}  ${ms(18)} ms`],
        dig: [`; <<>> DiG 9.20 <<>> ${host}`, ";; ANSWER SECTION:", `${host}. 300 IN A 76.76.21.21`, `${host}. 300 IN AAAA 2606:4700::6810:84e5`, ";; Query time: " + ms(9) + " msec"],
        whois: [`Domain Name: ${host.toUpperCase()}`, "Registrar: BlairOS Directory", "Status: active", "Name Server: ns1.blairos.local", "Updated: today"]
      };
      return records[mode];
    }

    function renderTabs() {
      tabs.replaceChildren();
      (["ping", "trace", "dig", "whois"] as Tool[]).forEach((item) => tabs.append(button(`rounded-2xl border px-4 py-2 text-sm font-bold transition ${tool === item ? "border-cyan-300/60 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/10 text-white hover:bg-white/20"}`, item, () => {
        tool = item;
        renderTabs();
      })));
    }

    function renderHistory() {
      historyList.replaceChildren();
      history.slice(0, 6).forEach((host) => historyList.append(button("rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-mono text-white/65 hover:bg-white/10", host, () => {
        input.value = host;
        run();
      })));
    }

    function run() {
      const host = input.value.trim() || "blairhudson.com";
      input.value = host;
      history = [host, ...history.filter((item) => item !== host)].slice(0, 12);
      writeHistory(history);
      output.textContent = `$ ${tool} ${host}\nresolving host...`;
      const started = performance.now();
      window.setTimeout(() => {
        const lines = linesFor(tool, host);
        output.textContent = [`$ ${tool} ${host}`, ...lines, "", `completed in ${Math.round(performance.now() - started)} ms`].join("\n");
        stats.replaceChildren(stat("Interface", "Wi-Fi"), stat("Address", "10.0.0.42"), stat("Latency", `${lines.join(" ").match(/time=([0-9.]+)/)?.[1] ?? "18.0"} ms`), stat("History", String(history.length)));
        renderHistory();
      }, 350);
    }

    append(root, [
      append(el("header", "grid gap-3 rounded-[28px] border border-white/10 bg-black/25 p-5"), [el("h2", "text-3xl font-black tracking-[-0.07em]", { text: "Network Utility" }), stats]),
      append(el("div", "grid gap-3 rounded-3xl border border-white/10 bg-white/5 p-3"), [tabs, append(el("div", "flex flex-wrap gap-2"), [input, button("rounded-2xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-200", "Run", run)]), historyList]),
      output
    ]);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") run();
    });
    renderTabs();
    renderHistory();
    run();
    return root;
  }
};
