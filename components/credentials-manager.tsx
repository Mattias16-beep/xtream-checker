"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface CredentialProfile {
  id: string
  name: string
  username: string
  password: string
}

interface CredentialsManagerProps {
  onSelect: (profile: { username: string; password: string }) => void
  currentUsername: string
  currentPassword: string
}

const STORAGE_KEY = "xc-profiles"
const MAX_PROFILES = 10

export function CredentialsManager({
  onSelect,
  currentUsername,
  currentPassword,
}: CredentialsManagerProps) {
  const [profiles, setProfiles] = useState<CredentialProfile[]>([])
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [profileName, setProfileName] = useState("")

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setProfiles(JSON.parse(raw))
    } catch {
      setProfiles([])
    }
  }, [])

  function persist(updated: CredentialProfile[]) {
    setProfiles(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  function handleSave() {
    if (!profileName.trim()) return
    const newProfile: CredentialProfile = {
      id: crypto.randomUUID(),
      name: profileName.trim(),
      username: currentUsername,
      password: currentPassword,
    }
    persist([...profiles, newProfile])
    setProfileName("")
    setSaving(false)
  }

  function handleDelete(id: string) {
    persist(profiles.filter((p) => p.id !== id))
  }

  const canSave =
    currentUsername.trim().length > 0 && currentPassword.trim().length > 0

  return (
    <Card className="mb-4 border border-border bg-card">
      <CardContent className="p-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>Saved Profiles</span>
          <span className="text-xs">{expanded ? "▲" : "▼"}</span>
        </button>

        {expanded && (
          <div className="mt-3 space-y-2">
            {profiles.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No saved profiles. Fill credentials above and click Save.
              </p>
            ) : (
              <ul className="space-y-1">
                {profiles.map((profile) => {
                  const isActive = profile.username === currentUsername
                  return (
                    <li
                      key={profile.id}
                      className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted/50 text-foreground"
                      }`}
                    >
                      <button
                        type="button"
                        className="flex flex-1 items-center gap-2 text-left"
                        onClick={() =>
                          onSelect({
                            username: profile.username,
                            password: profile.password,
                          })
                        }
                      >
                        <span className="font-medium truncate max-w-[140px]">
                          {profile.name}
                        </span>
                        <span className="text-muted-foreground text-xs truncate">
                          {profile.username}
                        </span>
                        <span className="text-muted-foreground text-xs tracking-widest">
                          •••••
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(profile.id)}
                        className="ml-2 text-muted-foreground hover:text-destructive transition-colors text-xs leading-none"
                        aria-label="Delete profile"
                      >
                        ×
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {!saving ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1 h-7 text-xs"
                disabled={!canSave || profiles.length >= MAX_PROFILES}
                onClick={() => setSaving(true)}
              >
                Save current
              </Button>
            ) : (
              <div className="flex items-end gap-2 mt-2">
                <div className="flex flex-col gap-1 flex-1">
                  <Label htmlFor="profile-name" className="text-xs">
                    Profile name
                  </Label>
                  <Input
                    id="profile-name"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSave()
                      if (e.key === "Escape") {
                        setSaving(false)
                        setProfileName("")
                      }
                    }}
                    placeholder="e.g. Mon abo OVH"
                    className="h-7 text-xs"
                    autoFocus
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={!profileName.trim()}
                  onClick={handleSave}
                >
                  Save
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setSaving(false)
                    setProfileName("")
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
