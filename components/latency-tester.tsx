"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { GeoInfo } from "@/lib/types";

interface LatencyEntry {
  id: string;
  input: string;
  hostname: string;
  state: "pending" | "probing" | "pinging" | "done";
  resolvedIp?: string;
  geoInfo?: GeoInfo;
  clientLatency?: number;
  reachable?: boolean;
}

function flagEmoji(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .replace(/./g, (c) =>
      String.fromCodePoint(0x1f1e0 - 65 + c.charCodeAt(0))
    );
}

function LatencyBadge({
  reachable,
  latency,
  state,
}: {
  reachable?: boolean;
  latency?: number;
  state: LatencyEntry["state"];
}) {
  if (state !== "done") {
    return (
      <Badge variant="secondary" className="text-xs">
        —
      </Badge>
    );
  }
  if (!reachable) {
    return (
      <Badge className="bg-red-600 text-white text-xs hover:bg-red-600">
        Timeout
      </Badge>
    );
  }
  if (latency === undefined) {
    return (
      <Badge variant="secondary" className="text-xs">
        —
      </Badge>
    );
  }
  if (latency < 100) {
    return (
      <Badge className="bg-green-600 text-white text-xs hover:bg-green-600">
        {latency} ms
      </Badge>
    );
  }
  if (latency < 300) {
    return (
      <Badge className="bg-orange-500 text-white text-xs hover:bg-orange-500">
        {latency} ms
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-600 text-white text-xs hover:bg-red-600">
      {latency} ms
    </Badge>
  );
}

function StatusDot({ entry }: { entry: LatencyEntry }) {
  if (entry.state !== "done") {
    return <span className="inline-block w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />;
  }
  if (entry.reachable) {
    return <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />;
  }
  return <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />;
}

export default function LatencyTester() {
  const [text, setText] = useState("");
  const [entries, setEntries] = useState<LatencyEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState("");
  const idCounter = useRef(0);

  function nextId() {
    idCounter.current += 1;
    return String(idCounter.current);
  }

  function updateEntry(id: string, patch: Partial<LatencyEntry>) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e))
    );
  }

  async function runPing(entry: LatencyEntry) {
    const url = entry.input.startsWith("http")
      ? entry.input
      : "http://" + entry.input;
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      await fetch(url, {
        method: "HEAD",
        mode: "no-cors",
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timer);
      const elapsed = Math.round(performance.now() - start);
      updateEntry(entry.id, {
        reachable: true,
        clientLatency: elapsed,
        state: "done",
      });
    } catch {
      updateEntry(entry.id, { reachable: false, state: "done" });
    }
  }

  async function handleTest() {
    setWarning("");
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const unique = [...new Set(lines)];

    if (unique.length === 0) return;

    let targets = unique;
    if (unique.length > 20) {
      setWarning(`Only the first 20 of ${unique.length} entries will be tested.`);
      targets = unique.slice(0, 20);
    }

    function hostnameOf(t: string) {
      try {
        return new URL(t).hostname;
      } catch {
        return t.replace(/^https?:\/\//i, "").split("/")[0];
      }
    }

    const initial: LatencyEntry[] = targets.map((input) => ({
      id: nextId(),
      input,
      hostname: hostnameOf(input),
      state: "probing",
    }));

    setEntries(initial);
    setLoading(true);

    let probeResults: Array<{
      input: string;
      hostname: string;
      resolvedIp?: string;
      geoInfo?: GeoInfo;
      error?: string;
    }>;

    try {
      const res = await fetch("/api/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets }),
      });
      probeResults = await res.json();
    } catch {
      probeResults = initial.map((e) => ({
        input: e.input,
        hostname: e.hostname,
        error: "Probe request failed",
      }));
    }

    const afterProbe: LatencyEntry[] = initial.map((entry, i) => {
      const pr = probeResults[i];
      return {
        ...entry,
        hostname: pr?.hostname ?? entry.hostname,
        resolvedIp: pr?.resolvedIp,
        geoInfo: pr?.geoInfo,
        state: "pinging" as const,
      };
    });

    setEntries(afterProbe);

    await Promise.all(afterProbe.map(runPing));

    setLoading(false);
  }

  function handleClear() {
    setEntries([]);
    setWarning("");
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-4xl mx-auto">
      <p className="text-sm text-muted-foreground">
        Enter any URL, IP address or domain name one per line. Get DNS resolution, geolocation, ISP and latency measured from your network.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="One URL or domain per line"
        disabled={loading}
        className="w-full font-mono min-h-[100px] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />

      {warning && (
        <p className="text-sm text-orange-400">{warning}</p>
      )}

      <Button
        onClick={handleTest}
        disabled={loading || !text.trim()}
        className="w-full"
      >
        {loading ? "Testing…" : "Test"}
      </Button>

      {entries.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={loading}
            >
              Clear
            </Button>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-2 font-medium">Domain</th>
                    <th className="text-left px-4 py-2 font-medium">IP</th>
                    <th className="text-left px-4 py-2 font-medium">Location</th>
                    <th className="text-left px-4 py-2 font-medium">ISP</th>
                    <th className="text-left px-4 py-2 font-medium">Latency</th>
                    <th className="text-center px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {entries.map((entry) => {
                    const isActive =
                      entry.state === "probing" || entry.state === "pinging";
                    return (
                      <tr
                        key={entry.id}
                        className={
                          isActive
                            ? "animate-pulse bg-muted/30"
                            : "hover:bg-muted/20 transition-colors"
                        }
                      >
                        <td className="px-4 py-3 font-mono max-w-[160px]">
                          <span
                            className="block truncate"
                            title={entry.hostname}
                          >
                            {entry.hostname}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-muted-foreground text-xs whitespace-nowrap">
                          {entry.resolvedIp ?? "—"}
                        </td>
                        <td className="px-4 py-3 max-w-[180px]">
                          {entry.geoInfo ? (
                            <span
                              className="flex items-center gap-1 truncate"
                              title={`${entry.geoInfo.city}, ${entry.geoInfo.country}`}
                            >
                              <span>{flagEmoji(entry.geoInfo.countryCode)}</span>
                              <span className="truncate text-xs">
                                {entry.geoInfo.city}, {entry.geoInfo.country}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-[160px]">
                          {entry.geoInfo?.isp ? (
                            <span
                              className="block truncate text-xs text-muted-foreground"
                              title={entry.geoInfo.isp}
                            >
                              {entry.geoInfo.isp}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <LatencyBadge
                            reachable={entry.reachable}
                            latency={entry.clientLatency}
                            state={entry.state}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusDot entry={entry} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
      <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 px-4 py-4 text-sm">
        <p className="text-muted-foreground">
          For a real latency analysis with route tracing, use <strong className="text-foreground">mtr</strong> in your terminal — it combines ping and traceroute in real time:
        </p>
        <div className="flex flex-col gap-2">
          {[
            { os: "macOS", cmd: "sudo mtr domain.com" },
            { os: "Windows", cmd: "mtr domain.com" },
            { os: "Linux", cmd: "sudo mtr domain.com" },
          ].map(({ os, cmd }) => (
            <div key={os} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">{os}</span>
              <code className="flex-1 rounded bg-background px-2 py-1 font-mono text-xs text-foreground border border-border">
                {cmd}
              </code>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          <code className="font-mono">sudo</code> is required on macOS and Linux — mtr needs raw socket access. If not installed:{" "}
          <span className="text-foreground">macOS → </span><code className="font-mono">brew install mtr</code>
          {" · "}
          <span className="text-foreground">Windows → </span><code className="font-mono">winmtr-reset.github.io</code>
          {" · "}
          <span className="text-foreground">Linux → </span><code className="font-mono">sudo apt install mtr</code>
        </p>
      </div>
    </div>
  );
}
