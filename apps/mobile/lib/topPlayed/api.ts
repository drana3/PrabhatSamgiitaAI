import { remoteConfig } from "@/lib/kirtan/api"
import { createDemoTopPlayedApi } from "@/lib/topPlayed/demo"
import { createTopPlayedApi } from "@/lib/topPlayed/remote"
import type { TopPlayedApi } from "@/lib/topPlayed/types"
import { MOCKUP_DATA } from "@/lib/mockupMode"

/** The Top Played source the screens use: the real server, or in the web preview the demo that sends nothing. */
let instance: TopPlayedApi | null = null

export function topPlayedApi(): TopPlayedApi {
  if (!instance) {
    if (MOCKUP_DATA) {
      const demo = createDemoTopPlayedApi()
      ;(globalThis as { __topPlayedDemo?: unknown }).__topPlayedDemo = demo.control
      instance = demo
    } else instance = createTopPlayedApi(remoteConfig())
  }
  return instance
}

/** For tests. */
export function resetTopPlayedApi(): void {
  instance = null
}
