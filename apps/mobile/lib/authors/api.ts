import { remoteConfig } from "@/lib/kirtan/api"
import { createDemoApi } from "@/lib/authors/demo"
import { createAuthorsApi } from "@/lib/authors/remote"
import type { AuthorsApi } from "@/lib/authors/types"
import { MOCKUP_DATA } from "@/lib/mockupMode"

/**
 * The author API the screens use: the real one, or in the web preview (MOCKUP_DATA) the demo that answers from invented
 * pages and sends nothing. One instance per app run, so the demo keeps the page the person just created.
 */
let instance: AuthorsApi | null = null

export function authorsApi(): AuthorsApi {
  if (!instance) instance = MOCKUP_DATA ? createDemoApi() : createAuthorsApi(remoteConfig())
  return instance
}

/** For tests: drop the cached instance. */
export function resetAuthorsApi(): void {
  instance = null
}
