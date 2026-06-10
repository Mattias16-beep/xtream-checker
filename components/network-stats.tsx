"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GeoInfo } from "@/lib/types"

interface NetworkStatsProps {
  geoInfo?: GeoInfo
  resolvedIp?: string
  clientLatency?: number
  isLoadingLatency?: boolean
}

function countryFlagEmoji(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(0x1f1e0 - 65 + c.charCodeAt(0)))
}

function latencyColor(ms: number): string {
  if (ms < 100) return "text-green-400"
  if (ms <= 300) return "text-orange-400"
  return "text-red-400"
}

interface StatRowProps {
  label: string
  value: React.ReactNode
}

function StatRow({ label, value }: StatRowProps) {
  return (
    <>
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </>
  )
}

export function NetworkStats({
  geoInfo,
  resolvedIp,
  clientLatency,
  isLoadingLatency,
}: NetworkStatsProps) {
  let latencyNode: React.ReactNode
  if (isLoadingLatency) {
    latencyNode = <span className="text-muted-foreground">Measuring...</span>
  } else if (clientLatency !== undefined) {
    latencyNode = (
      <span className={latencyColor(clientLatency)}>{clientLatency}ms</span>
    )
  } else {
    latencyNode = <span className="text-muted-foreground">N/A</span>
  }

  const locationParts: string[] = []
  if (geoInfo) {
    const flag = geoInfo.countryCode ? countryFlagEmoji(geoInfo.countryCode) : ""
    if (flag) locationParts.push(flag)
    if (geoInfo.country) locationParts.push(geoInfo.country)
    if (geoInfo.city) locationParts.push(geoInfo.city)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Network</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <StatRow label="Your Latency" value={latencyNode} />
          {locationParts.length > 0 && (
            <StatRow label="Server Location" value={locationParts.join(" ")} />
          )}
          {resolvedIp && <StatRow label="Host" value={resolvedIp} />}
          {geoInfo && (geoInfo.isp || geoInfo.org) && (
            <StatRow
              label="ISP / Host Provider"
              value={[geoInfo.isp, geoInfo.org].filter(Boolean).join(" · ")}
            />
          )}
          {geoInfo?.as && <StatRow label="ASN" value={geoInfo.as} />}
        </div>
      </CardContent>
    </Card>
  )
}
