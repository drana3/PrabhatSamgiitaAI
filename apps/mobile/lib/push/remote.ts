import { callUrl, type RemoteConfig } from "@/lib/kirtan/remote"

/** The phone's side of the push API (apps/api `/api/v1/push`). Plain `fetch`; the wiring is lib/kirtan/api.ts. */

export type PushPlatform = "ios" | "android"

export type PushPreferences = {
  replies: boolean
  /** false while the server has push off: the switch still saves, nothing is sent yet */
  server_enabled: boolean
}

function url(cfg: RemoteConfig, path: string): string {
  return `${cfg.baseUrl.replace(/\/+$/, "")}/api/v1/push${path}`
}

export async function registerDevice(cfg: RemoteConfig, input: { token: string; platform: PushPlatform; language: string }): Promise<void> {
  await callUrl<{ registered: boolean }>(cfg, "PUT", url(cfg, "/devices"), input)
}

export async function unregisterDevice(cfg: RemoteConfig, token: string): Promise<void> {
  await callUrl<{ registered: boolean }>(cfg, "POST", url(cfg, "/devices/unregister"), { token })
}

export async function getPreferences(cfg: RemoteConfig): Promise<PushPreferences> {
  return callUrl<PushPreferences>(cfg, "GET", url(cfg, "/preferences"))
}

export async function setRepliesPreference(cfg: RemoteConfig, replies: boolean): Promise<PushPreferences> {
  return callUrl<PushPreferences>(cfg, "PUT", url(cfg, "/preferences"), { replies })
}
