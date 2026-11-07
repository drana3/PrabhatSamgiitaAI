import type { StoreApi, UseBoundStore } from "zustand"

import { ownerKeyOf, rotateOwner, type OwnedData } from "@/lib/account/owner"
import { useAuthStore } from "@/stores/authStore"

type PersistedStore<S> = UseBoundStore<StoreApi<S>> & {
  persist: {
    hasHydrated: () => boolean
    onFinishHydration: (fn: () => void) => () => void
  }
}

/**
 * Keeps one persisted store's account data in step with whoever is signed in (see lib/account/owner.ts).
 * `pick` reads the account's part of the state, `apply` writes it back, `empty` is what a new owner starts with.
 * The owner stamp and the put-aside data live in `holder` (the store itself by default).
 * Runs on every auth change and when the stores finished loading from disk: before that the auth store still
 * holds its "guest" default, so rotating then would wrongly put a signed-in person's data aside.
 */
export function bindOwner<S, D, H extends OwnedData<D> = S & OwnedData<D>>(
  store: PersistedStore<S>,
  options: {
    pick: (state: S) => D
    empty: () => D
    apply: (data: D) => Partial<S>
    holder?: PersistedStore<H>
  },
): () => void {
  const holder = (options.holder ?? (store as unknown as PersistedStore<H>)) as PersistedStore<H>
  const reconcile = () => {
    if (!store.persist.hasHydrated() || !holder.persist.hasHydrated() || !useAuthStore.persist.hasHydrated()) return
    const held = holder.getState()
    const next = ownerKeyOf(useAuthStore.getState())
    if (held.owner === next) return
    const rotation = rotateOwner<D>(held, options.pick(store.getState()), next, options.empty())
    holder.setState({ owner: rotation.owner, slots: rotation.slots } as unknown as Partial<H>)
    store.setState(options.apply(rotation.data) as Partial<S>)
  }
  useAuthStore.subscribe(reconcile)
  useAuthStore.persist.onFinishHydration(reconcile)
  store.persist.onFinishHydration(reconcile)
  if (holder !== (store as unknown)) holder.persist.onFinishHydration(reconcile)
  reconcile()
  return reconcile
}
