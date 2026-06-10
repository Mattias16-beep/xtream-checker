"use client"

import { useEffect, useState } from "react"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { parseXtreamUrl } from "@/lib/parse-xtream-url"
import type { XtreamCredentials } from "@/lib/types"


const CREDS_KEY = "xc-credentials"

function loadSavedCreds(): { username: string; password: string } {
  try {
    return JSON.parse(localStorage.getItem(CREDS_KEY) ?? "{}")
  } catch {
    return { username: "", password: "" }
  }
}

interface CheckerFormProps {
  onSubmit: (credentials: XtreamCredentials) => void
  onBulkSubmit: (urls: string[], username: string, password: string) => void
  onTabChange?: (tab: string) => void
  isLoading: boolean
  prefill?: { serverUrl: string; username: string; password?: string } | null
}

export function CheckerForm({ onSubmit, onBulkSubmit, onTabChange, isLoading, prefill }: CheckerFormProps) {
  const [tab, setTab] = useState<string>("fields")
  const [serverUrl, setServerUrl] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [fullUrl, setFullUrl] = useState("")
  const [urlError, setUrlError] = useState(false)
  const [bulkUrls, setBulkUrls] = useState("")

  useEffect(() => {
    const saved = loadSavedCreds()
    if (saved.username) setUsername(saved.username)
    if (saved.password) setPassword(saved.password)
  }, [])

  useEffect(() => {
    if (username || password) {
      localStorage.setItem(CREDS_KEY, JSON.stringify({ username, password }))
    }
  }, [username, password])

  useEffect(() => {
    if (prefill) {
      setServerUrl(prefill.serverUrl)
      setUsername(prefill.username)
      if (prefill.password !== undefined) setPassword(prefill.password)
      setTab("fields")
    }
  }, [prefill])

  function handleFullUrlChange(value: string) {
    setFullUrl(value)
    if (!value.trim()) {
      setUrlError(false)
      return
    }
    const parsed = parseXtreamUrl(value)
    if (parsed) {
      setServerUrl(parsed.serverUrl)
      setUsername(parsed.username)
      setPassword(parsed.password)
      setUrlError(false)
      setTab("fields")
    } else {
      setUrlError(true)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!serverUrl.trim() || !username.trim() || !password.trim()) return
    onSubmit({ serverUrl: serverUrl.trim(), username: username.trim(), password: password.trim() })
  }

  function handleBulkSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password.trim()) return
    const urls = bulkUrls
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("http"))
    if (urls.length === 0) return
    onBulkSubmit(urls, username.trim(), password.trim())
  }

  const canSubmit = serverUrl.trim() && username.trim() && password.trim() && !isLoading
  const canBulkSubmit = bulkUrls.trim() && username.trim() && password.trim() && !isLoading

  return (
    <div className="flex flex-col gap-4">
      {tab !== "url" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="off"
            />
          </div>
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => {
        if (v === "url") {
          setServerUrl("")
          setUsername("")
          setPassword("")
          setFullUrl("")
        }
        setTab(v)
        onTabChange?.(v)
      }}>
        <TabsList className="w-full">
          <TabsTrigger value="fields" className="flex-1">Single</TabsTrigger>
          <TabsTrigger value="bulk" className="flex-1">Bulk</TabsTrigger>
          <TabsTrigger value="url" className="flex-1">Full URL</TabsTrigger>
        </TabsList>

        <TabsContent value="fields" className="mt-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="serverUrl">Server URL</Label>
              <Input
                id="serverUrl"
                type="url"
                placeholder="http://domain.com:8080"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <button type="submit" disabled={!canSubmit} className={cn(buttonVariants(), "w-full")}>
              {isLoading ? <Spinner /> : "Check"}
            </button>
          </form>
        </TabsContent>

        <TabsContent value="url" className="mt-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fullUrl">Paste Xtream URL</Label>
            <Input
              id="fullUrl"
              placeholder="http://domain.com:8080/get.php?username=…&password=…"
              value={fullUrl}
              onChange={(e) => handleFullUrlChange(e.target.value)}
              disabled={isLoading}
              aria-invalid={urlError || undefined}
            />
            {urlError && (
              <p className="text-xs text-destructive">Invalid Xtream URL format</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="bulk" className="mt-4">
          <form onSubmit={handleBulkSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bulkUrls">Server URLs (one per line)</Label>
              <textarea
                id="bulkUrls"
                className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 resize-y"
                placeholder={"http://server1.com:8080\nhttp://server2.com:8080\nhttp://server3.com:25461"}
                value={bulkUrls}
                onChange={(e) => setBulkUrls(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Uses the username &amp; password above for all URLs
              </p>
            </div>
            <button type="submit" disabled={!canBulkSubmit} className={cn(buttonVariants(), "w-full")}>
              {isLoading ? <Spinner /> : "Check All"}
            </button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Spinner() {
  return (
    <span className="flex items-center gap-2">
      <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
      Checking…
    </span>
  )
}
