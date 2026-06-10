import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const MAX_STREAMS = 200

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

function parseM3u(content: string): M3uResult {
  const lines = content.split('\n').map((l) => l.trim())
  const streams: M3uStream[] = []
  const groupCounts: Record<string, number> = {}

  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i]
    if (!line.startsWith('#EXTINF')) continue

    const urlLine = lines[i + 1]
    if (!urlLine || urlLine.startsWith('#') || !urlLine.startsWith('http')) continue

    const groupMatch = line.match(/group-title="([^"]*)"/)
    const nameMatch = line.match(/,(.+)$/)
    const group = groupMatch?.[1]?.trim() || 'Uncategorized'
    const name = nameMatch?.[1]?.trim() || 'Unknown'

    groupCounts[group] = (groupCounts[group] ?? 0) + 1

    if (streams.length < MAX_STREAMS) {
      streams.push({ name, group, url: urlLine })
    }
  }

  const total = Object.values(groupCounts).reduce((a, b) => a + b, 0)
  const groups = Object.entries(groupCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  return { total, groups, streams, truncated: total > MAX_STREAMS }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { url?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { url } = body
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error()
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)

    const reader = res.body?.getReader()
    if (!reader) return NextResponse.json({ error: 'Empty response' }, { status: 400 })

    let bytes = 0
    const chunks: Uint8Array[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > MAX_BYTES) {
        reader.cancel()
        break
      }
      chunks.push(value)
    }

    const content = new TextDecoder().decode(
      chunks.reduce((acc, c) => {
        const merged = new Uint8Array(acc.length + c.length)
        merged.set(acc)
        merged.set(c, acc.length)
        return merged
      }, new Uint8Array(0))
    )

    if (!content.includes('#EXTM3U') && !content.includes('#EXTINF')) {
      return NextResponse.json({ error: `Not a valid M3U file. Server returned: ${content.slice(0, 300)}` }, { status: 400 })
    }

    const result = parseM3u(content)
    return NextResponse.json(result)
  } catch (err) {
    clearTimeout(timeout)
    const msg = err instanceof Error ? err.message : 'Failed to fetch M3U'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
