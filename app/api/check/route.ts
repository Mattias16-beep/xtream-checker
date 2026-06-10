import { NextRequest, NextResponse } from 'next/server'
import dns from 'dns'
import { CheckResult, GeoInfo, XtreamServerInfo, XtreamUserInfo } from '@/lib/types'

export const runtime = 'nodejs'

async function resolveHostname(hostname: string): Promise<string | undefined> {
  try {
    const addresses = await dns.promises.resolve4(hostname)
    return addresses[0]
  } catch {
    return undefined
  }
}

async function fetchGeoInfo(ip: string): Promise<GeoInfo | undefined> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=country,countryCode,city,isp,org,as,query`,
      { signal: controller.signal }
    )
    clearTimeout(timeout)
    const data = await response.json()
    return {
      ip: data.query,
      country: data.country,
      countryCode: data.countryCode,
      city: data.city,
      isp: data.isp,
      org: data.org,
      as: data.as,
    }
  } catch {
    return undefined
  }
}

async function fetchDnsAndGeo(
  hostname: string
): Promise<{ resolvedIp: string | undefined; geoInfo: GeoInfo | undefined }> {
  const resolvedIp = await resolveHostname(hostname)
  if (!resolvedIp) {
    return { resolvedIp: undefined, geoInfo: undefined }
  }
  const geoInfo = await fetchGeoInfo(resolvedIp)
  return { resolvedIp, geoInfo }
}

async function fetchIptv(
  serverUrl: string,
  username: string,
  password: string
): Promise<{ userInfo: XtreamUserInfo; serverInfo: XtreamServerInfo } | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(
      `${serverUrl}/player_api.php?username=${username}&password=${password}`,
      { signal: controller.signal }
    )
    clearTimeout(timeout)
    const data = await response.json()
    return {
      userInfo: data.user_info,
      serverInfo: data.server_info,
    }
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
    return NextResponse.json(
      { error: 'serverUrl, username, and password are required' },
      { status: 400 }
    )
  }

  let hostname: string
  try {
    hostname = new URL(serverUrl).hostname
  } catch {
    return NextResponse.json({ error: 'Invalid serverUrl' }, { status: 400 })
  }

  const [iptvResult, networkResult] = await Promise.allSettled([
    fetchIptv(serverUrl, username, password),
    fetchDnsAndGeo(hostname),
  ])

  const network =
    networkResult.status === 'fulfilled'
      ? networkResult.value
      : { resolvedIp: undefined, geoInfo: undefined }

  if (iptvResult.status === 'rejected') {
    const result: CheckResult = {
      status: 'unreachable',
      errorMessage: iptvResult.reason instanceof Error ? iptvResult.reason.message : String(iptvResult.reason),
    }
    return NextResponse.json(result)
  }

  const iptv = iptvResult.value

  if (!iptv || !iptv.userInfo) {
    const result: CheckResult = {
      status: 'error',
      errorMessage: 'Unexpected response format from server',
      resolvedIp: network.resolvedIp,
      geoInfo: network.geoInfo,
    }
    return NextResponse.json(result)
  }

  if (iptv.userInfo.auth === 0) {
    const result: CheckResult = {
      status: 'invalid_credentials',
      userInfo: iptv.userInfo,
      serverInfo: iptv.serverInfo,
      resolvedIp: network.resolvedIp,
      geoInfo: network.geoInfo,
    }
    return NextResponse.json(result)
  }

  const result: CheckResult = {
    status: 'valid',
    userInfo: iptv.userInfo,
    serverInfo: iptv.serverInfo,
    resolvedIp: network.resolvedIp,
    geoInfo: network.geoInfo,
  }
  return NextResponse.json(result)
}
