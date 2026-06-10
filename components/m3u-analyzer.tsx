"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface M3uStream {
  name: string
  group: string
  url: string
}

interface M3uResult {
  total: number
  groups: { name: string; count: number }[]
  streams: M3uStream[]
  truncated: boolean
}

interface StreamTest {
  name: string
  url: string
  state: "pending" | "testing" | "reachable" | "dead"
  latency?: number
}

async function testStream(url: string): Promise<{ reachable: boolean; latency: number }> {
  const start = performance.now()
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    await fetch(url, { method: "HEAD", mode: "no-cors", cache: "no-store", signal: controller.signal })
    clearTimeout(timer)
    return { reachable: true, latency: Math.round(performance.now() - start) }
  } catch {
    return { reachable: false, latency: Math.round(performance.now() - start) }
  }
}

export default function M3uAnalyzer() {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<M3uResult | null>(null)
  const [streamTests, setStreamTests] = useState<StreamTest[] | null>(null)
  const [testing, setTesting] = useState(false)

  async function handleAnalyze() {
    if (!url.trim()) return
    setLoading(true)
    setError("")
    setResult(null)
    setStreamTests(null)

    try {
      const res = await fetch("/api/m3u", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to analyze playlist")
      } else {
        setResult(data)
      }
    } catch {
      setError("Failed to reach the analyzer service")
    } finally {
      setLoading(false)
    }
  }

  async function handleTestSample() {
    if (!result) return
    setTesting(true)

    const pool = [...result.streams]
    const sample: M3uStream[] = []
    while (sample.length < 10 && pool.length > 0) {
      const i = Math.floor(Math.random() * pool.length)
      sample.push(pool.splice(i, 1)[0])
    }

    const tests: StreamTest[] = sample.map((s) => ({ name: s.name, url: s.url, state: "pending" }))
    setStreamTests(tests)

    await Promise.all(
      tests.map(async (t, i) => {
        setStreamTests((prev) =>
          prev ? prev.map((x, j) => (j === i ? { ...x, state: "testing" } : x)) : prev
        )
        const { reachable, latency } = await testStream(t.url)
        setStreamTests((prev) =>
          prev
            ? prev.map((x, j) =>
                j === i ? { ...x, state: reachable ? "reachable" : "dead", latency } : x
              )
            : prev
        )
      })
    )

    setTesting(false)
  }

  const maxCount = result ? Math.max(...result.groups.map((g) => g.count), 1) : 1

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Paste your M3U URL to analyze your playlist — channel count, categories breakdown and stream sampling.
      </p>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="m3u-url">M3U URL</Label>
          <div className="flex gap-2">
            <Input
              id="m3u-url"
              type="url"
              placeholder="http://server.com:8080/get.php?username=…&password=…&type=m3u_plus"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            />
            <Button onClick={handleAnalyze} disabled={loading || !url.trim()} className="shrink-0">
              {loading ? "Analyzing…" : "Analyze"}
            </Button>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {result && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-2xl font-bold">{result.total.toLocaleString()}</span>
            <span className="text-muted-foreground text-sm">streams found</span>
            {result.truncated && (
              <Badge variant="secondary" className="text-xs">showing first 200</Badge>
            )}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Categories ({result.groups.length})</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={handleTestSample}
                  disabled={testing || result.streams.length === 0}
                >
                  {testing ? "Testing…" : "Test 10 random streams"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {result.groups.map((g) => (
                <div key={g.name} className="flex items-center gap-3 text-sm">
                  <span className="w-40 truncate shrink-0 text-muted-foreground text-xs" title={g.name}>
                    {g.name}
                  </span>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.round((g.count / maxCount) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right shrink-0">{g.count}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {streamTests && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Stream Sample Test</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5">
                {streamTests.map((t, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <span
                      className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                        t.state === "pending" || t.state === "testing"
                          ? "bg-muted-foreground/40 animate-pulse"
                          : t.state === "reachable"
                          ? "bg-green-500"
                          : "bg-red-500"
                      }`}
                    />
                    <span className="flex-1 truncate text-muted-foreground" title={t.name}>{t.name}</span>
                    {t.state === "reachable" && t.latency !== undefined && (
                      <span className={t.latency < 100 ? "text-green-400" : t.latency < 300 ? "text-orange-400" : "text-red-400"}>
                        {t.latency}ms
                      </span>
                    )}
                    {t.state === "dead" && <span className="text-red-400">Timeout</span>}
                    {t.state === "testing" && <span className="text-muted-foreground">…</span>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
