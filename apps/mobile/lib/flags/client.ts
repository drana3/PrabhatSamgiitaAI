/**
 * Feature flags and A/B groups, phone side (docs/analytics-flags.md). The server decides (rollout
 * percent, app version, platform, the person's group); the phone asks once at launch and keeps
 * the answer for ten minutes and across launches, so the app works offline and never waits for it.
 *
 * Everything is injected so tests use fakes. A flag the server does not know, or any failure,
 * means the default in `FLAG_DEFAULTS`, which is OFF: a broken network can never switch a new
 * feature on.
 */
export type FlagState = { enabled: boolean; variant: string }

export const OFF: FlagState = { enabled: false, variant: "off" }

/**
 * What a flag is while the server has not answered. Add a line here when you add a flag in code;
 * keep it OFF unless the feature is already live for everyone.
 */
export const FLAG_DEFAULTS: Readonly<Record<string, FlagState>> = {}

export type FlagStorage = {
  get: () => Promise<string | null>
  set: (value: string) => Promise<void>
}

export type FlagsDeps = {
  /** full URL of GET /api/v1/flags; empty = never ask (preview builds) */
  endpoint: string | undefined
  fetch: typeof fetch
  installId: () => Promise<string>
  appVersion: string | undefined
  platform: string | undefined
  storage: FlagStorage
  now?: () => number
  ttlMs?: number
  /** called ONCE per flag per launch, when a screen really used it (the A/B exposure) */
  onExposure?: (flag: string, variant: string) => void
  defaults?: Readonly<Record<string, FlagState>>
}

export type FlagsClient = {
  refresh: (force?: boolean) => Promise<void>
  load: () => Promise<void>
  get: (key: string) => FlagState
  /** read a flag AND record that the person was exposed to it (use in the screen that shows it) */
  use: (key: string) => FlagState
  subscribe: (listener: () => void) => () => void
  snapshot: () => number
}

type Saved = { at: number; flags: Record<string, FlagState> }

function isState(value: unknown): value is FlagState {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as FlagState).enabled === "boolean" &&
    typeof (value as FlagState).variant === "string"
  )
}

function cleanFlags(raw: unknown): Record<string, FlagState> {
  const out: Record<string, FlagState> = {}
  if (typeof raw !== "object" || raw === null) return out
  for (const [key, value] of Object.entries(raw)) if (isState(value)) out[key] = { enabled: value.enabled, variant: value.variant }
  return out
}

export function createFlagsClient(deps: FlagsDeps): FlagsClient {
  const now = deps.now ?? Date.now
  const ttl = deps.ttlMs ?? 10 * 60_000
  const defaults = deps.defaults ?? FLAG_DEFAULTS
  let current: Record<string, FlagState> = {}
  let fetchedAt = 0
  let version = 0
  const listeners = new Set<() => void>()
  const exposed = new Set<string>()
  let inflight: Promise<void> | null = null

  function set(next: Record<string, FlagState>) {
    current = next
    version += 1
    for (const listener of [...listeners]) listener()
  }

  async function load() {
    try {
      const raw = await deps.storage.get()
      if (!raw) return
      const saved = JSON.parse(raw) as Saved
      if (saved && typeof saved.at === "number") {
        fetchedAt = saved.at
        set(cleanFlags(saved.flags))
      }
    } catch {
      // a damaged cache is the same as no cache
    }
  }

  async function doRefresh() {
    if (!deps.endpoint) return
    try {
      const id = await deps.installId()
      const headers: Record<string, string> = { "X-Install-Id": id }
      if (deps.appVersion) headers["X-App-Version"] = deps.appVersion
      if (deps.platform) headers["X-Platform"] = deps.platform
      const response = await deps.fetch(deps.endpoint, { headers })
      if (!response.ok) return
      const body = (await response.json()) as { flags?: unknown }
      const flags = cleanFlags(body.flags)
      fetchedAt = now()
      set(flags)
      await deps.storage.set(JSON.stringify({ at: fetchedAt, flags } satisfies Saved)).catch(() => undefined)
    } catch {
      // offline or server down: keep what we have
    }
  }

  function refresh(force = false): Promise<void> {
    if (!force && fetchedAt > 0 && now() - fetchedAt < ttl) return Promise.resolve()
    if (!inflight) inflight = doRefresh().finally(() => (inflight = null))
    return inflight
  }

  function get(key: string): FlagState {
    return current[key] ?? defaults[key] ?? OFF
  }

  function use(key: string): FlagState {
    const state = get(key)
    // Only a flag the server really answered for counts as an exposure; a default is not an experiment.
    if (key in current && !exposed.has(key)) {
      exposed.add(key)
      try {
        deps.onExposure?.(key, state.enabled ? state.variant : "off")
      } catch {
        // exposure logging is best effort
      }
    }
    return state
  }

  return {
    refresh,
    load,
    get,
    use,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    snapshot: () => version,
  }
}
