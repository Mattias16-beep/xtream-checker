"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const CREDS_KEY = "xc-credentials"

function buildM3uUrl(serverUrl: string, username: string, password: string): string {
  return `${serverUrl}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u_plus&output=ts`
}

export function GenerateTab() {
  const [serverUrl, setServerUrl] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CREDS_KEY) ?? "{}")
      if (saved.username) setUsername(saved.username)
      if (saved.password) setPassword(saved.password)
    } catch {}
  }, [])

  const canGenerate = serverUrl.trim() && username.trim() && password.trim()
  const m3uUrl = canGenerate
    ? buildM3uUrl(serverUrl.trim(), username.trim(), password.trim())
    : ""

  async function handleCopy() {
    await navigator.clipboard.writeText(m3uUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleClear() {
    setServerUrl("")
    setUsername("")
    setPassword("")
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Fill in the fields below to generate the M3U link.
      </p>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gen-server">Server URL</Label>
          <Input
            id="gen-server"
            type="url"
            placeholder="http://domain.com:8080"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gen-username">Username</Label>
          <Input
            id="gen-username"
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gen-password">Password</Label>
          <Input
            id="gen-password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
          />
        </div>
        <Button variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={handleClear}>
          Clear
        </Button>
      </div>

      {canGenerate && (
        <div className="flex flex-col gap-2">
          <Label>Generated M3U URL</Label>
          <div className="rounded-md border border-input bg-muted px-3 py-2 font-mono text-xs text-muted-foreground break-all select-all">
            {m3uUrl}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleCopy}>
              {copied ? "✓ Copied!" : "Copy"}
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => window.open(m3uUrl, "_blank")}>
              Open in new tab
            </Button>
          </div>

        </div>
      )}
    </div>
  )
}
