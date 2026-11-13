import { apiBaseUrl } from "@/lib/client"
import { ownerKeyOf } from "@/lib/account/owner"
import { createLearnSyncEngine, type SyncOutcome } from "@/lib/learn/syncEngine"
import { createLearnSyncTransport } from "@/lib/learn/syncApi"
import { authHeadersFromStore, memberAuthAvailable } from "@/lib/memberAuth"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useAuthStore } from "@/stores/authStore"
import { useLearnStore } from "@/stores/learnStore"
import { useLearnSyncStore } from "@/stores/learnSyncStore"

/**
 * Learn progress follows a signed-in member to another phone (docs/learn-sync.md).
 *
 * `startLearnSync()` is called once from MemberSessionSync. It pulls when the app starts and when someone signs
 * in, pushes a few seconds after the learning list or a song's progress changes, and again when the app comes
 * back to the foreground (`syncLearnNow`). A guest is never touched: there is no account to keep it in. The
 * local data is the app's source of truth; the server copy only fills in what is missing or newer.
 */

/** Wait this long after the last change before sending, so a burst of taps is one request. */
export const PUSH_DEBOUNCE_MS = 4_000

let writingLocal = false

function allHydrated(): boolean {
  return (
    useAuthStore.persist.hasHydrated() && useLearnStore.persist.hasHydrated() && useLearnSyncStore.persist.hasHydrated()
  )
}

/** `member:<id>` of the signed-in person, only when their data is the one in the Learn store right now. */
function currentOwner(): string | null {
  if (MOCKUP_DATA || !memberAuthAvailable() || !allHydrated()) return null
  const auth = useAuthStore.getState()
  if (auth.mode !== "signed_in") return null
  const owner = ownerKeyOf(auth)
  // the Learn store swaps its data when the account changes; until it has, its data is someone else's
  return useLearnStore.getState().owner === owner ? owner : null
}

const engine = createLearnSyncEngine({
  owner: currentOwner,
  epoch: () => useAuthStore.getState().sessionEpoch,
  readLists: () => {
    const { songs, paths } = useLearnStore.getState()
    return { songs, paths }
  },
  writeLists: (lists) => {
    writingLocal = true
    try {
      useLearnStore.setState({ songs: lists.songs, paths: lists.paths })
    } finally {
      writingLocal = false
    }
  },
  readMeta: (owner) => useLearnSyncStore.getState().byOwner[owner] ?? {},
  writeMeta: (owner, meta) => useLearnSyncStore.getState().setMeta(owner, meta),
  transport: createLearnSyncTransport({ baseUrl: apiBaseUrl, headers: () => authHeadersFromStore() }),
  now: () => Date.now(),
})

/** Sync now, whatever the retry pause. Safe to call at any time; resolves to what happened. */
export function syncLearnNow(): Promise<SyncOutcome> {
  return engine.syncNow({ force: true })
}

let started = false
let timer: ReturnType<typeof setTimeout> | null = null

/** How many rounds in a row may follow each other because something was still waiting afterwards. */
const MAX_FOLLOW_UPS = 3
let followUps = 0

function scheduleSync(delayMs: number, fromFollowUp = false) {
  if (!fromFollowUp) followUps = 0
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void engine.syncNow().then((outcome) => {
      if (outcome.status === "ok" && outcome.pending && followUps < MAX_FOLLOW_UPS) {
        followUps += 1
        scheduleSync(PUSH_DEBOUNCE_MS, true)
      }
    })
  }, delayMs)
}

/** Wire the triggers. Idempotent; returns a function that removes them again (for tests). */
export function startLearnSync(): () => void {
  if (started) return () => undefined
  started = true

  const unsubLearn = useLearnStore.subscribe((state, previous) => {
    if (writingLocal) return
    if (state.songs !== previous.songs || state.paths !== previous.paths) scheduleSync(PUSH_DEBOUNCE_MS)
  })
  const unsubAuth = useAuthStore.subscribe((state, previous) => {
    if (state.mode !== previous.mode || state.memberId !== previous.memberId) scheduleSync(1_000)
  })
  const unsubHydration = [
    useAuthStore.persist.onFinishHydration(() => scheduleSync(1_000)),
    useLearnStore.persist.onFinishHydration(() => scheduleSync(1_000)),
    useLearnSyncStore.persist.onFinishHydration(() => scheduleSync(1_000)),
  ]
  // the Learn store moves a signed-in person's data into place a moment after sign-in; try again then
  const unsubOwner = useLearnStore.subscribe((state, previous) => {
    if (state.owner !== previous.owner) scheduleSync(1_000)
  })
  scheduleSync(1_000)

  return () => {
    started = false
    if (timer) clearTimeout(timer)
    timer = null
    unsubLearn()
    unsubAuth()
    unsubOwner()
    for (const off of unsubHydration) off()
  }
}
