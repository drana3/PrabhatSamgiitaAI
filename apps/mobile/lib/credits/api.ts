import { createDemoCreditsApi } from "@/lib/credits/demo"
import { createCreditsApi, type CreditsApi } from "@/lib/credits/remote"
import { remoteConfig } from "@/lib/kirtan/api"
import { MOCKUP_DATA } from "@/lib/mockupMode"

/** The credits API the screens use: the real one, or in the web preview (MOCKUP_DATA) the demo that sends nothing. One per app run. */
let instance: CreditsApi | null = null

export function creditsApi(): CreditsApi {
  if (!instance) instance = MOCKUP_DATA ? createDemoCreditsApi() : createCreditsApi(remoteConfig())
  return instance
}

/** For tests: drop the cached instance. */
export function resetCreditsApi(): void {
  instance = null
}
