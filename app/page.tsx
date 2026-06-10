"use client"

import { useCallback, useEffect, useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { CheckerForm } from "@/components/checker-form"
import { ResultCard } from "@/components/result-card"
import { NetworkStats } from "@/components/network-stats"
import { HistoryList } from "@/components/history-list"
import { BulkResults } from "@/components/bulk-results"
import LatencyTester from "@/components/latency-tester"
import type {
  BulkHistoryEntry,
  BulkResult,
  BulkValidDetail,
  CheckResult,
  CheckStatus,
  HistoryEntry,
  SingleHistoryEntry,
  XtreamCredentials,
} from "@/lib/types"

const HISTORY_KEY = "xc-history"
const MAX_HISTORY = 20
const BULK_CONCURRENCY = 5

function loadHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]")
  } catch {
    return []
  }
}

function saveHistory(entries: HistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries))
}

async function measureClientLatency(serverUrl: string): Promise<number | undefined> {
  try {
    const t0 = performance.now()
    await fetch(serverUrl, { method: "HEAD", mode: "no-cors", cache: "no-store" })
    const elapsed = Math.round(performance.now() - t0)
    return elapsed > 0 ? elapsed : undefined
  } catch {
    return undefined
  }
}

async function checkOne(credentials: XtreamCredentials): Promise<CheckResult> {
  const res = await fetch("/api/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  })
  if (res.status === 429) {
    const data = await res.json().catch(() => ({}))
    return { status: "rate_limited", errorMessage: data.error }
  }
  return res.json()
}

export default function HomePage() {
  const [result, setResult] = useState<CheckResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [clientLatency, setClientLatency] = useState<number | undefined>()
  const [isLoadingLatency, setIsLoadingLatency] = useState(false)
  const [prefill, setPrefill] = useState<{ serverUrl: string; username: string; password?: string } | null>(null)
  const [lastCredentials, setLastCredentials] = useState<XtreamCredentials | null>(null)
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null)
  const [isBulkLoading, setIsBulkLoading] = useState(false)
  const [bulkCredentials, setBulkCredentials] = useState<{ username: string; password: string } | null>(null)

  useEffect(() => {
    setHistory(loadHistory())
  }, [])

  function pushHistory(entry: HistoryEntry) {
    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, MAX_HISTORY)
      saveHistory(next)
      return next
    })
  }

  const handleSubmit = useCallback(async (credentials: XtreamCredentials) => {
    setIsLoading(true)
    setResult(null)
    setBulkResults(null)
    setClientLatency(undefined)
    setIsLoadingLatency(false)
    setLastCredentials(credentials)

    try {
      const data = await checkOne(credentials)
      setResult(data)

      const validStatuses: CheckStatus[] = ["valid", "invalid_credentials", "unreachable"]
      if (validStatuses.includes(data.status)) {
        const entry: SingleHistoryEntry = {
          id: crypto.randomUUID(),
          type: "single",
          host: new URL(credentials.serverUrl).host,
          username: credentials.username,
          status: data.status as SingleHistoryEntry["status"],
          timestamp: Date.now(),
          userInfo: data.status === "valid" ? data.userInfo : undefined,
          geoInfo: data.status === "valid" ? data.geoInfo : undefined,
        }
        pushHistory(entry)
      }

      if (data.status === "valid" || data.status === "invalid_credentials") {
        setIsLoadingLatency(true)
        measureClientLatency(credentials.serverUrl).then((ms) => {
          setClientLatency(ms)
          setIsLoadingLatency(false)
        })
      }
    } catch {
      setResult({ status: "error", errorMessage: "Failed to reach the checker service." })
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleBulkSubmit = useCallback(async (urls: string[], username: string, password: string) => {
    setIsBulkLoading(true)
    setResult(null)
    setClientLatency(undefined)
    setBulkCredentials({ username, password })

    const initial: BulkResult[] = urls.map((serverUrl) => ({
      id: crypto.randomUUID(),
      serverUrl,
      result: null,
      state: "pending",
    }))
    setBulkResults(initial)

    let index = 0
    const finalResults: CheckResult[] = new Array(urls.length).fill(null)

    async function runNext(): Promise<void> {
      const i = index++
      if (i >= urls.length) return

      const serverUrl = urls[i]
      const credentials: XtreamCredentials = { serverUrl, username, password }

      setBulkResults((prev) =>
        prev ? prev.map((r, j) => (j === i ? { ...r, state: "loading" } : r)) : prev
      )

      let data: CheckResult
      try {
        data = await checkOne(credentials)
      } catch {
        data = { status: "error", errorMessage: "Failed" }
      }

      let latency: number | undefined
      if (data.status === "valid" || data.status === "invalid_credentials") {
        latency = await measureClientLatency(serverUrl)
      }

      finalResults[i] = data
      setBulkResults((prev) =>
        prev
          ? prev.map((r, j) =>
              j === i ? { ...r, result: data, clientLatency: latency, state: "done" } : r
            )
          : prev
      )
    }

    await Promise.all(
      Array.from({ length: Math.min(BULK_CONCURRENCY, urls.length) }, async () => {
        while (index < urls.length) await runNext()
      })
    )

    const valid = finalResults.filter((r) => r?.status === "valid").length
    const invalid = finalResults.filter((r) => r?.status === "invalid_credentials").length
    const unreachable = finalResults.filter((r) => r?.status === "unreachable").length

    const validDetails: BulkValidDetail[] = finalResults
      .map((r, i) => ({ r, url: urls[i] }))
      .filter(({ r }) => r?.status === "valid")
      .map(({ r, url }) => ({
        serverUrl: url,
        userInfo: r.userInfo,
        geoInfo: r.geoInfo,
      }))

    const entry: BulkHistoryEntry = {
      id: crypto.randomUUID(),
      type: "bulk",
      username,
      count: urls.length,
      valid,
      invalid,
      unreachable,
      validDetails,
      timestamp: Date.now(),
    }
    pushHistory(entry)

    setIsBulkLoading(false)
  }, [])

  const handleCheckSingle = useCallback((serverUrl: string) => {
    if (!bulkCredentials) return
    setPrefill({ serverUrl, username: bulkCredentials.username, password: bulkCredentials.password })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [bulkCredentials])

  const handleHistorySelect = useCallback((entry: HistoryEntry) => {
    if (entry.type === "single") {
      setPrefill({ serverUrl: `http://${entry.host}`, username: entry.username })
    } else {
      setPrefill({ serverUrl: "", username: entry.username })
    }
  }, [])

  const handleRecheck = useCallback((entry: SingleHistoryEntry) => {
    setPrefill({ serverUrl: `http://${entry.host}`, username: entry.username })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  const handleClearHistory = useCallback(() => {
    setHistory([])
    saveHistory([])
  }, [])

  const showNetworkStats =
    result != null &&
    (result.status === "valid" || result.status === "invalid_credentials")

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Xtream Checker</h1>
        <p className="text-sm text-muted-foreground">
          Verify Xtream Codes IPTV credentials and server availability
        </p>
      </div>

      <Tabs defaultValue="checker">
        <TabsList className="w-full">
          <TabsTrigger value="checker" className="flex-1">Checker</TabsTrigger>
          <TabsTrigger value="latency" className="flex-1">Latency Tester</TabsTrigger>
        </TabsList>

        <TabsContent value="checker" className="mt-6 flex flex-col gap-6">
          <CheckerForm
            onSubmit={handleSubmit}
            onBulkSubmit={handleBulkSubmit}
            onTabChange={(tab) => {
              if (tab === "generate" || tab === "url") {
                setResult(null)
                setClientLatency(undefined)
                setBulkResults(null)
              }
            }}
            isLoading={isLoading || isBulkLoading}
            prefill={prefill}
          />

          {result && result.status !== "idle" && result.status !== "loading" && (
            <ResultCard result={result} credentials={lastCredentials ?? undefined} />
          )}

          {showNetworkStats && (
            <NetworkStats
              geoInfo={result?.geoInfo}
              resolvedIp={result?.resolvedIp}
              clientLatency={clientLatency}
              isLoadingLatency={isLoadingLatency}
            />
          )}

          {bulkResults && bulkCredentials && (
            <BulkResults
              results={bulkResults}
              total={bulkResults.length}
              username={bulkCredentials.username}
              password={bulkCredentials.password}
              onCheckSingle={handleCheckSingle}
            />
          )}

          <HistoryList
            entries={history}
            onSelect={handleHistorySelect}
            onRecheck={handleRecheck}
            onClear={handleClearHistory}
          />
        </TabsContent>

        <TabsContent value="latency" className="mt-6">
          <LatencyTester />
        </TabsContent>
      </Tabs>
    </main>
  )
}
