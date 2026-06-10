"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { CheckResult, XtreamCredentials } from "@/lib/types"

function formatExpDate(expDate: string | null): string {
  if (expDate === null) return "Never"
  const ts = parseInt(expDate, 10)
  if (isNaN(ts)) return expDate
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function expirationWarning(expDate: string | null): { label: string; className: string } | null {
  if (expDate === null) return null
  const ts = parseInt(expDate, 10)
  if (isNaN(ts)) return null
  const daysLeft = Math.ceil((ts * 1000 - Date.now()) / 86_400_000)
  if (daysLeft < 0) return { label: "Expired", className: "bg-red-500/15 text-red-400 border-red-500/30" }
  if (daysLeft <= 7) return { label: `Expires in ${daysLeft}d`, className: "bg-red-500/15 text-red-400 border-red-500/30" }
  if (daysLeft <= 30) return { label: `Expires in ${daysLeft}d`, className: "bg-orange-500/15 text-orange-400 border-orange-500/30" }
  return null
}

function statusLabel(status: string): { label: string; className: string } {
  switch (status.toLowerCase()) {
    case "active":
      return { label: "Active", className: "text-green-400" }
    case "expired":
      return { label: "Expired", className: "text-red-400" }
    case "banned":
      return { label: "Banned", className: "text-red-500" }
    default:
      return { label: status, className: "text-muted-foreground" }
  }
}

interface InfoRowProps {
  label: string
  value: React.ReactNode
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </>
  )
}

export function ResultCard({ result, credentials }: { result: CheckResult; credentials?: XtreamCredentials }) {
  const [copied, setCopied] = useState(false)
  const [showM3u, setShowM3u] = useState(false)

  const m3uUrl = credentials
    ? `${credentials.serverUrl}/get.php?username=${encodeURIComponent(credentials.username)}&password=${encodeURIComponent(credentials.password)}&type=m3u_plus&output=ts`
    : null

  async function copyM3uUrl() {
    if (!m3uUrl) return
    await navigator.clipboard.writeText(m3uUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (result.status === "valid" && result.userInfo) {
    const { userInfo } = result
    const { label: sLabel, className: sClass } = statusLabel(userInfo.status)
    const expWarning = expirationWarning(userInfo.exp_date)

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="w-fit bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/15">
              ✓ Valid Subscription
            </Badge>
            {expWarning && (
              <Badge className={`w-fit ${expWarning.className}`}>
                ⚠ {expWarning.label}
              </Badge>
            )}
          </div>
          {m3uUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowM3u((v) => !v)}
              className="shrink-0"
            >
              {showM3u ? "Hide M3U URL" : "Generate M3U URL"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <InfoRow label="Expiration" value={formatExpDate(userInfo.exp_date)} />
            <InfoRow
              label="Status"
              value={<span className={sClass}>{sLabel}</span>}
            />
            <InfoRow label="Max Connections" value={userInfo.max_connections} />
            <InfoRow
              label="Formats"
              value={
                userInfo.allowed_output_formats.length > 0
                  ? userInfo.allowed_output_formats.join(", ")
                  : "—"
              }
            />
          </div>

          {showM3u && m3uUrl && (
            <div className="flex flex-col gap-2">
              <div className="rounded-md border border-green-500/20 bg-green-500/5 px-3 py-2 font-mono text-xs text-muted-foreground break-all select-all">
                {m3uUrl}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={copyM3uUrl}>
                  {copied ? "✓ Copied!" : "Copy"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => window.open(m3uUrl, "_blank")}
                >
                  Open in new tab
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (result.status === "invalid_credentials") {
    return (
      <Card>
        <CardHeader>
          <Badge className="w-fit bg-orange-500/15 text-orange-400 border-orange-500/30 hover:bg-orange-500/15">
            ⚠ Invalid Credentials
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The username or password you entered is incorrect. Please double-check
            your credentials and try again.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (result.status === "unreachable") {
    return (
      <Card>
        <CardHeader>
          <Badge className="w-fit bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/15">
            ✗ Server Unreachable
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The server could not be reached. Verify the URL is correct and that
            the server is online.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (result.status === "rate_limited") {
    return (
      <Card>
        <CardHeader>
          <Badge variant="secondary" className="w-fit">
            ⏱ Rate Limited
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {result.errorMessage ?? "Too many requests. Please wait before trying again."}
          </p>
        </CardContent>
      </Card>
    )
  }

  if (result.status === "error") {
    return (
      <Card>
        <CardHeader>
          <Badge variant="destructive" className="w-fit">
            Error
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {result.errorMessage ?? "An unexpected error occurred."}
          </p>
        </CardContent>
      </Card>
    )
  }

  return null
}
