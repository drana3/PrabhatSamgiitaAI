import { callUrl, type RemoteConfig } from "@/lib/kirtan/remote"

/**
 * The team's pins for the Search menu (apps/api/app/api/v1/search_menu.py). Reading is public; writing is the team's alone
 * (the server refuses anyone else). A failed read is not an error for the person: the menu keeps the last list it stored.
 */

export async function fetchMenuPins(cfg: RemoteConfig): Promise<string[]> {
  const out = await callUrl<{ pins?: unknown }>(cfg, "GET", `${cfg.baseUrl}/api/v1/search-menu/pins`)
  return Array.isArray(out.pins) ? out.pins.filter((p): p is string => typeof p === "string") : []
}

/** Team only. Replaces the whole list (at most three ids; an empty list clears the pins). */
export async function saveMenuPins(cfg: RemoteConfig, pins: readonly string[]): Promise<string[]> {
  const out = await callUrl<{ pins?: unknown }>(cfg, "PUT", `${cfg.baseUrl}/api/v1/admin/search-menu/pins`, { pins })
  return Array.isArray(out.pins) ? out.pins.filter((p): p is string => typeof p === "string") : []
}
