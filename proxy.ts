import { NextRequest, NextResponse } from "next/server"

const LIMIT = 10
const WINDOW_MS = 60_000

interface WindowEntry {
  timestamps: number[]
}

const store = new Map<string, WindowEntry>()

export function proxy(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"

  const now = Date.now()
  const windowStart = now - WINDOW_MS

  const entry = store.get(ip) ?? { timestamps: [] }
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart)

  const remaining = LIMIT - entry.timestamps.length

  if (remaining <= 0) {
    const oldest = entry.timestamps[0]
    const resetAt = oldest + WINDOW_MS
    const retryAfter = Math.ceil((resetAt - now) / 1000)

    return NextResponse.json(
      {
        error: "Too many requests. Please wait before trying again.",
        retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(LIMIT),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
        },
      }
    )
  }

  entry.timestamps.push(now)
  store.set(ip, entry)

  const resetAt = entry.timestamps[0] + WINDOW_MS
  const response = NextResponse.next()
  response.headers.set("X-RateLimit-Limit", String(LIMIT))
  response.headers.set("X-RateLimit-Remaining", String(remaining - 1))
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)))
  return response
}

export const config = {
  matcher: ["/api/check"],
}
