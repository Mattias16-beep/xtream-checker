export interface XtreamCredentials {
  serverUrl: string
  username: string
  password: string
}

export interface XtreamUserInfo {
  username: string
  password: string
  message: string
  auth: number
  status: string
  exp_date: string | null
  is_trial: string
  active_cons: string
  created_at: string
  max_connections: string
  allowed_output_formats: string[]
}

export interface XtreamServerInfo {
  url: string
  port: string
  https_port: string
  server_protocol: string
  rtmp_port: string
  timezone: string
  timestamp_now: number
  time_now: string
}

export interface GeoInfo {
  ip: string
  country: string
  countryCode: string
  city: string
  isp: string
  org: string
  as: string
}

export type CheckStatus = 'idle' | 'loading' | 'valid' | 'invalid_credentials' | 'unreachable' | 'rate_limited' | 'error'

export interface CatalogInfo {
  live: number
  vod: number
  series: number
}

export interface CheckResult {
  status: CheckStatus
  userInfo?: XtreamUserInfo
  serverInfo?: XtreamServerInfo
  geoInfo?: GeoInfo
  resolvedIp?: string
  errorMessage?: string
  catalogInfo?: CatalogInfo
}

export interface SingleHistoryEntry {
  id: string
  type: 'single'
  host: string
  username: string
  status: 'valid' | 'invalid_credentials' | 'unreachable'
  timestamp: number
  userInfo?: XtreamUserInfo
  geoInfo?: GeoInfo
}

export interface BulkValidDetail {
  serverUrl: string
  userInfo?: XtreamUserInfo
  geoInfo?: GeoInfo
}

export interface BulkHistoryEntry {
  id: string
  type: 'bulk'
  username: string
  count: number
  valid: number
  invalid: number
  unreachable: number
  timestamp: number
  validDetails?: BulkValidDetail[]
}

export type HistoryEntry = SingleHistoryEntry | BulkHistoryEntry

export interface BulkResult {
  id: string
  serverUrl: string
  result: CheckResult | null
  clientLatency?: number
  state: 'pending' | 'loading' | 'done'
}
