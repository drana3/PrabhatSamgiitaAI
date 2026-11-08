import { registerDevice, unregisterDevice, type PushPlatform } from "@/lib/push/remote"
import type { RemoteConfig } from "@/lib/kirtan/remote"

/**
 * Keeps the server's list of phones right. One controller per app run. `reconcile` is called with whether this phone
 * SHOULD be woken now (signed in, the notification switch on, the OS permission granted, push on in this build):
 *
 * - should, and not registered with this member yet: ask the OS for the Expo token and send it (a new sign-in, a new
 *   member on the same phone, the app started again: the server just refreshes the row);
 * - should not, and registered: take the token off, with the headers that were valid when it was registered (a sign-out
 *   has already cleared the member by then, so the headers are kept here, in memory only);
 * - never throws: push is a convenience, the bell has every notice anyway.
 */
export type PushContext = {
  /** the member the registration is for (a new member re-registers) */
  memberId: string | null
  language: string
  platform: PushPlatform
}

export type PushDeps = {
  /** the app's server address and the member's headers as they are NOW */
  config: () => RemoteConfig
  /** the Expo push token, or null when there is none (no permission, no project id, a simulator) */
  getToken: () => Promise<string | null>
}

export type PushController = {
  reconcile: (should: boolean, ctx: PushContext) => Promise<"registered" | "removed" | "unchanged" | "skipped">
  /** the token registered now (tests, the settings screen) */
  current: () => string | null
}

export function createPushController(deps: PushDeps): PushController {
  let registered: { token: string; memberId: string | null; language: string; cfg: RemoteConfig } | null = null
  // one call at a time: a quick change of the switch must not interleave a register and a remove
  let chain: Promise<unknown> = Promise.resolve()

  async function run(should: boolean, ctx: PushContext) {
    try {
      if (!should) {
        if (!registered) return "unchanged" as const
        const old = registered
        registered = null
        await unregisterDevice(old.cfg, old.token).catch(() => undefined)
        return "removed" as const
      }
      if (registered && registered.memberId === ctx.memberId && registered.language === ctx.language) return "unchanged" as const
      const token = await deps.getToken()
      if (!token) return "skipped" as const
      const cfg = deps.config()
      // a phone that was another member's: the server moves the token; nothing to remove first
      await registerDevice(cfg, { token, platform: ctx.platform, language: ctx.language })
      // the headers are kept as they are now, for the day the member signs out
      const headers = cfg.headers()
      registered = { token, memberId: ctx.memberId, language: ctx.language, cfg: { ...cfg, headers: () => headers } }
      return "registered" as const
    } catch {
      return "skipped" as const
    }
  }

  return {
    reconcile: (should, ctx) => {
      const next = chain.then(() => run(should, ctx))
      chain = next.catch(() => undefined)
      return next
    },
    current: () => registered?.token ?? null,
  }
}
