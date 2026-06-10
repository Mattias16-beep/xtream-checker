import { NextRequest, NextResponse } from 'next/server'
import { CatalogInfo } from '@/lib/types'

export const runtime = 'nodejs'

async function fetchCount(url: string): Promise<number> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    const data = await res.json()
    return Array.isArray(data) ? data.length : 0
  } catch {
    return 0
  } finally {
    clearTimeout(timeout)
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { serverUrl?: string; username?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { serverUrl, username, password } = body
  if (!serverUrl || !username || !password) {
    return NextResponse.json({ error: 'serverUrl, username, and password are required' }, { status: 400 })
  }

  const base = `${serverUrl}/player_api.php?username=${username}&password=${password}&action=`

  const [live, vod, series] = await Promise.allSettled([
    fetchCount(`${base}get_live_streams`),
    fetchCount(`${base}get_vod_streams`),
    fetchCount(`${base}get_series`),
  ])

  const catalogInfo: CatalogInfo = {
    live: live.status === 'fulfilled' ? live.value : 0,
    vod: vod.status === 'fulfilled' ? vod.value : 0,
    series: series.status === 'fulfilled' ? series.value : 0,
  }

  return NextResponse.json(catalogInfo)
}
