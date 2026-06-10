"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { BulkHistoryEntry, BulkValidDetail, HistoryEntry, SingleHistoryEntry } from "@/lib/types"

interface HistoryListProps {
  entries: HistoryEntry[]
  onSelect: (entry: HistoryEntry) => void
  onClear: () => void
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes} min ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return "Yesterday"
  return `${days}d ago`
}

function formatExpDate(expDate: string | null | undefined): string {
  if (!expDate) return "Never"
  const ts = parseInt(expDate, 10)
  if (isNaN(ts)) return expDate
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  })
}

function ValidDetailPanel({ details }: { details: BulkValidDetail[] }) {
  return (
    <div className="mx-4 mb-3 flex flex-col gap-2">
      {details.map((d, i) => (
        <div key={i} className="rounded-md border border-green-500/20 bg-green-500/5 px-3 py-2 text-xs">
          <div className="mb-1 truncate font-mono text-muted-foreground">{d.serverUrl}</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            {d.userInfo?.exp_date !== undefined && (
              <>
                <span className="text-muted-foreground">Expires</span>
                <span>{formatExpDate(d.userInfo.exp_date)}</span>
              </>
            )}
            {d.userInfo?.status && (
              <>
                <span className="text-muted-foreground">Status</span>
                <span className={d.userInfo.status.toLowerCase() === "active" ? "text-green-400" : "text-red-400"}>
                  {d.userInfo.status}
                </span>
              </>
            )}
            {d.userInfo?.max_connections && (
              <>
                <span className="text-muted-foreground">Connections</span>
                <span>{d.userInfo.max_connections}</span>
              </>
            )}
            {d.geoInfo && (
              <>
                <span className="text-muted-foreground">Location</span>
                <span>{d.geoInfo.city}, {d.geoInfo.country}</span>
              </>
            )}
            {d.geoInfo?.isp && (
              <>
                <span className="text-muted-foreground">ISP</span>
                <span className="truncate">{d.geoInfo.isp}</span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function SingleEntryRow({ entry }: { entry: SingleHistoryEntry }) {
  const badge =
    entry.status === "valid" ? (
      <Badge className="bg-green-500/15 text-green-400 border-green-500/20">Valid</Badge>
    ) : entry.status === "invalid_credentials" ? (
      <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/20">Invalid</Badge>
    ) : (
      <Badge className="bg-red-500/15 text-red-400 border-red-500/20">Dead</Badge>
    )

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{entry.host}</span>
        <span className="truncate text-xs text-muted-foreground">{entry.username}</span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        {badge}
        <span className="text-xs text-muted-foreground">{formatRelativeTime(entry.timestamp)}</span>
      </div>
    </div>
  )
}

function BulkEntryRow({
  entry,
  expanded,
  onToggle,
}: {
  entry: BulkHistoryEntry
  expanded: boolean
  onToggle: () => void
}) {
  const hasValidDetails = (entry.validDetails?.length ?? 0) > 0

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Bulk · {entry.count} URLs</span>
              {hasValidDetails && (
                <span className="text-xs text-muted-foreground">{expanded ? "▲" : "▼"}</span>
              )}
            </div>
            <span className="truncate text-xs text-muted-foreground">
              {entry.username} ·{" "}
              <span className="text-green-400">{entry.valid} valid</span>
              {entry.invalid > 0 && <span className="text-orange-400"> · {entry.invalid} invalid</span>}
              {entry.unreachable > 0 && <span className="text-red-400"> · {entry.unreachable} dead</span>}
            </span>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatRelativeTime(entry.timestamp)}
          </span>
        </div>
      </button>
      {expanded && hasValidDetails && (
        <ValidDetailPanel details={entry.validDetails!} />
      )}
    </div>
  )
}

export function HistoryList({ entries, onSelect, onClear }: HistoryListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">History</span>
        {entries.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear history
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No history yet</p>
          ) : (
            <ul>
              {entries.map((entry, index) => (
                <li key={entry.id}>
                  {index > 0 && <div className="mx-4 h-px bg-border" />}
                  {entry.type === "single" ? (
                    <button
                      type="button"
                      onClick={() => onSelect(entry)}
                      className="w-full px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    >
                      <SingleEntryRow entry={entry} />
                    </button>
                  ) : (
                    <BulkEntryRow
                      entry={entry}
                      expanded={expandedId === entry.id}
                      onToggle={() => toggleExpand(entry.id)}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
