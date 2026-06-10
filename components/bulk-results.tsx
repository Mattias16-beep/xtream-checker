"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { BulkResult } from "@/lib/types"

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
  const done = results.filter((r) => r.state === "done").length
  const valid = results.filter((r) => r.result?.status === "valid").length

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Bulk Results</CardTitle>
        <span className="text-xs text-muted-foreground">
          {done}/{total} checked · {valid} valid
        </span>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {results.map((item) => {
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
