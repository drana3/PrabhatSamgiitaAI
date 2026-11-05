import AsyncStorage from "@react-native-async-storage/async-storage"
import { AppState } from "react-native"

import type { StateStorage } from "zustand/middleware"

/**
 * Storage of the assistant history. A streamed answer updates the store once per piece of text, and every
 * update used to write the whole history to the phone. Writes now wait until the answer pauses
 * (WRITE_DELAY_MS) and are forced out when the app leaves the foreground, so nothing is lost and typing in the
 * field stays smooth.
 */
export const WRITE_DELAY_MS = 800

export function createDebouncedStorage(
  base: Pick<StateStorage, "getItem" | "setItem" | "removeItem"> = AsyncStorage,
  delay = WRITE_DELAY_MS,
): StateStorage & { flush: () => Promise<void> } {
  const pending = new Map<string, string>()
  let timer: ReturnType<typeof setTimeout> | null = null

  const flush = async () => {
    if (timer) clearTimeout(timer)
    timer = null
    const entries = [...pending.entries()]
    pending.clear()
    await Promise.all(entries.map(([key, value]) => Promise.resolve(base.setItem(key, value)).catch(() => undefined)))
  }

  return {
    getItem: (key) => (pending.has(key) ? (pending.get(key) ?? null) : base.getItem(key)),
    setItem: (key, value) => {
      pending.set(key, value)
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void flush(), delay)
    },
    removeItem: async (key) => {
      pending.delete(key)
      await base.removeItem(key)
    },
    flush,
  }
}

/** Keep a long conversation from growing the stored history without end (the oldest go first). */
export const MAX_THREADS_PER_ACCOUNT = 40
export const MAX_MESSAGES_PER_THREAD = 120

export function trimHistory<T extends { messages: unknown[]; updatedAt?: number }>(threads: T[]): T[] {
  return [...threads]
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, MAX_THREADS_PER_ACCOUNT)
    .map((thread) =>
      thread.messages.length > MAX_MESSAGES_PER_THREAD
        ? { ...thread, messages: thread.messages.slice(-MAX_MESSAGES_PER_THREAD) }
        : thread,
    )
}

export const chatStorage = createDebouncedStorage()
try {
  AppState.addEventListener("change", (state) => {
    if (state !== "active") void chatStorage.flush()
  })
} catch {
  /* no AppState (tests): writes still happen after the delay */
}
