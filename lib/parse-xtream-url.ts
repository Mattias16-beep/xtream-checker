import { XtreamCredentials } from "@/lib/types"

export function parseXtreamUrl(input: string): XtreamCredentials | null {
  let url: URL

  try {
    url = new URL(input.trim())
  } catch {
    return null
  }

  const serverUrl = `${url.protocol}//${url.host}`
  const username = url.searchParams.get("username")
  const password = url.searchParams.get("password")

  if (!username || !password) return null

  return { serverUrl, username, password }
}
