"use client"

import { useState, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { BulkResult } from "@/lib/types"

type FilterState = "all" | "valid" | "invalid" | "dead"

function StatusBadge({ result }: { result: BulkResult }) {
  if (result.state === "pending")
    return <Badge variant="secondary">Pending</Badge>
  if (result.state === "loading")
    return <Badge variant="secondary" className="animate-pulse">Checking…</Badge>

  const status = result.result?.status
  if (status === "valid")
    return <Badge className="bg-green-500/15 text-green-400 border-green-500/30">Valid</Badge>
  if (status === "invalid_credentials")
    return <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/30">Invalid</Badge>
  if (status === "unreachable")
    return <Badge className="bg-red-500/15 text-red-400 border-red-500/30">Dead</Badge>
  return <Badge variant="destructive">Error</Badge>
}

function latencyColor(ms: number) {
  if (ms < 100) return "text-green-400"
  if (ms <= 300) return "text-orange-400"
  return "text-red-400"
}

function formatExpDate(exp: string | null | undefined): string {
  if (!exp) return ""
  const ts = parseInt(exp, 10)
  if (isNaN(ts)) return ""
  return new Date(ts * 1000).toISOString().slice(0, 10)
}

interface BulkResultsProps {
  results: BulkResult[]
  total: number
  username: string
  password: string
  onCheckSingle: (serverUrl: string) => void
}

function ValidActions({
  serverUrl,
  username,
  password,
  onCheckSingle,
}: {
  serverUrl: string
  username: string
  password: string
  onCheckSingle: (url: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const [showUrl, setShowUrl] = useState(false)

  const m3uUrl = `${serverUrl}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u_plus&output=ts`

  async function copy() {
    await navigator.clipboard.writeText(m3uUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-2 px-4 pb-3">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setShowUrl((v) => !v)}>
          {showUrl ? "Hide M3U" : "Generate M3U"}
        </Button>
        <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => onCheckSingle(serverUrl)}>
          Check Single ↗
        </Button>
      </div>
      {showUrl && (
        <div className="flex flex-col gap-1.5">
          <div className="rounded-md border border-green-500/20 bg-green-500/5 px-3 py-2 font-mono text-xs text-muted-foreground break-all select-all">
            {m3uUrl}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={copy}>
              {copied ? "✓ Copied!" : "Copy"}
            </Button>
            <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={() => window.open(m3uUrl, "_blank")}>
              Open in new tab
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function BulkResults({ results, total, username, password, onCheckSingle }: BulkResultsProps) {
  const [filter, setFilter] = useState<FilterState>("all")
  const [sortByLatency, setSortByLatency] = useState(false)
  const [copiedAll, setCopiedAll] = useState(false)

  const done = results.filter((r) => r.state === "done").length
  const valid = results.filter((r) => r.result?.status === "valid").length
  const invalid = results.filter((r) => r.result?.status === "invalid_credentials").length
  const dead = results.filter((r) => r.result?.status === "unreachable").length

  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0
  const isComplete = done === total && total > 0

  const filteredAndSorted = useMemo(() => {
    let list = results.filter((r) => {
      if (filter === "all") return true
      if (filter === "valid") return r.result?.status === "valid"
      if (filter === "invalid") return r.result?.status === "invalid_credentials"
      if (filter === "dead") return r.result?.status === "unreachable"
      return true
    })

    if (sortByLatency) {
      list = [...list].sort((a, b) => {
        if (a.clientLatency === undefined && b.clientLatency === undefined) return 0
        if (a.clientLatency === undefined) return 1
        if (b.clientLatency === undefined) return -1
        return a.clientLatency - b.clientLatency
      })
    }

    return list
  }, [results, filter, sortByLatency])

  async function copyAllValidUrls() {
    const urls = results
      .filter((r) => r.result?.status === "valid")
      .map((r) => `${r.serverUrl}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u_plus&output=ts`)
    await navigator.clipboard.writeText(urls.join("\n"))
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }

  function exportCsv() {
    const header = "server_url,status,ip,country,latency_ms,expiration"
    const rows = results.map((r) => {
      const status = r.result?.status ?? ""
      const ip = r.result?.resolvedIp ?? r.result?.geoInfo?.ip ?? ""
      const country = r.result?.geoInfo?.countryCode ?? ""
      const latency = r.clientLatency !== undefined ? String(r.clientLatency) : ""
      const expiration = formatExpDate(r.result?.userInfo?.exp_date)
      return [r.serverUrl, status, ip, country, latency, expiration]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    })
    const csv = [header, ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "xtream-bulk-results.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const filterButtons: { label: string; value: FilterState }[] = [
    { label: "All", value: "all" },
    { label: "Valid", value: "valid" },
    { label: "Invalid", value: "invalid" },
    { label: "Dead", value: "dead" },
  ]

  return (
    <Card>
      <CardHeader className="pb-2 space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Bulk Results</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={copyAllValidUrls}
              disabled={valid === 0}
            >
              {copiedAll ? `✓ Copied ${valid} URLs` : "Copy all valid M3U URLs"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={exportCsv}
              disabled={results.length === 0}
            >
              Export CSV
            </Button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          {done}/{total} checked · ✓ {valid} · ⚠ {invalid} · ✗ {dead}
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-1">
            {filterButtons.map(({ label, value }) => (
              <Button
                key={value}
                variant={filter === value ? "secondary" : "ghost"}
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => setFilter(value)}
              >
                {label}
              </Button>
            ))}
          </div>
          <Button
            variant={sortByLatency ? "secondary" : "ghost"}
            size="sm"
            className="text-xs h-7 px-2"
            onClick={() => setSortByLatency((v) => !v)}
          >
            Sort by latency ↑
          </Button>
        </div>
      </CardHeader>

      <div className="h-1 w-full bg-muted overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${isComplete ? "bg-green-500" : "bg-blue-500"}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {filteredAndSorted.map((item) => {
            const geo = item.result?.geoInfo
            const ip = item.result?.resolvedIp
            const isValid = item.result?.status === "valid"

            return (
              <div key={item.id}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <StatusBadge result={item} />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                    {item.serverUrl}
                  </span>
                  <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                    {ip && <span>{ip}</span>}
                    {geo?.countryCode && (
                      <span title={`${geo.city}, ${geo.country}`}>
                        {geo.countryCode}
                      </span>
                    )}
                    {item.clientLatency !== undefined && (
                      <span className={latencyColor(item.clientLatency)}>
                        {item.clientLatency}ms
                      </span>
                    )}
                  </div>
                </div>
                {isValid && (
                  <ValidActions
                    serverUrl={item.serverUrl}
                    username={username}
                    password={password}
                    onCheckSingle={onCheckSingle}
                  />
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
