import { createContext, useContext, useRef, useSyncExternalStore, type ReactNode } from "react"

import {
  SCROLL_MODE,
  lyricsInView,
  readingLine,
  reduceReading,
  stanzaAtLine,
  type ReadingMode,
  type Span,
} from "@/lib/songPage/readingStrip"

/**
 * What the lyrics and the reading strip share while the page scrolls: where the stanzas are, where the page is
 * scrolled to, which stanza is under the reader's eye and whether the strip follows it or is pinned to a tapped
 * stanza. A small store of its own (not React state), so a scroll step re-draws only what really changed: the
 * stanza that lights up and the strip. The numbers are decided by lib/songPage/readingStrip.ts.
 */
export type ReadingSnapshot = {
  scrollY: number
  viewHeight: number
  /** the pinned bars on top (title bar and section strip) */
  topInset: number
  /** what the strip and the mini-player take at the bottom of the screen */
  bottomReserve: number
  /** where the tab body starts inside the text block */
  bodyY: number
  spans: readonly Span[]
  mode: ReadingMode
  /** the stanza under the reader's eye (Scroll mode), -1 when there are no stanzas */
  current: number
  /** the lyrics are on screen enough for the strip to be there */
  inView: boolean
}

const INITIAL: ReadingSnapshot = {
  scrollY: 0,
  viewHeight: 800,
  topInset: 100,
  bottomReserve: 160,
  bodyY: 0,
  spans: [],
  mode: SCROLL_MODE,
  current: -1,
  inView: false,
}

export class ReadingStore {
  private snap: ReadingSnapshot = INITIAL
  private listeners = new Set<() => void>()
  /** the page's y (in the scroll content) of the top of the text block's content area; set by the page */
  base: () => number = () => 0

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  get = () => this.snap

  private commit(patch: Partial<ReadingSnapshot>) {
    const next: ReadingSnapshot = { ...this.snap, ...patch }
    const derived = this.derive(next)
    const merged: ReadingSnapshot = { ...next, ...derived }
    const changed = (Object.keys(merged) as Array<keyof ReadingSnapshot>).some((k) => merged[k] !== this.snap[k])
    if (!changed) return
    this.snap = merged
    this.listeners.forEach((l) => l())
  }

  /** current stanza, in-view flag and a pin that lets go, from the numbers in `s` */
  private derive(s: ReadingSnapshot): Pick<ReadingSnapshot, "current" | "inView" | "mode"> {
    if (!s.spans.length) return { current: -1, inView: false, mode: s.mode }
    const top = this.base() + s.bodyY - s.scrollY
    const last = s.spans[s.spans.length - 1] as Span
    const bottom = top + last.top + last.height
    const visibleTop = s.topInset
    const visibleBottom = s.viewHeight - s.bottomReserve
    const line = readingLine(visibleTop, visibleBottom)
    const windowSpans = s.spans.map((span) => ({ top: top + span.top, height: span.height }))
    return {
      current: stanzaAtLine(windowSpans, line),
      inView: lyricsInView({ top, bottom, visibleTop, visibleBottom }),
      mode: s.mode,
    }
  }

  setScroll(y: number, now: number = Date.now()) {
    const mode = reduceReading(this.snap.mode, { type: "scroll", y, now })
    this.commit({ scrollY: y, mode })
  }

  setViewport(viewHeight: number, topInset: number) {
    this.commit({ viewHeight, topInset })
  }

  setBottomReserve(bottomReserve: number) {
    this.commit({ bottomReserve })
  }

  setBodyY(bodyY: number) {
    this.commit({ bodyY })
  }

  setSpans(spans: readonly Span[]) {
    this.commit({ spans })
  }

  tap(index: number, now: number = Date.now()) {
    this.commit({ mode: reduceReading(this.snap.mode, { type: "tap", index, y: this.snap.scrollY, now }) })
  }

  release() {
    this.commit({ mode: SCROLL_MODE })
  }
}

const ReadingContext = createContext<ReadingStore | null>(null)

/** One store per song page (made by the page with `useReadingStoreOfPage`, so the page itself can feed it the scroll). */
export function ReadingProvider({ store, children }: { store: ReadingStore; children: ReactNode }) {
  return <ReadingContext.Provider value={store}>{children}</ReadingContext.Provider>
}

/** Makes the page's store once. Set `store.base` on every render: the scroll-content y of the text block's content area. */
export function useReadingStoreOfPage(): ReadingStore {
  const ref = useRef<ReadingStore | null>(null)
  if (!ref.current) ref.current = new ReadingStore()
  return ref.current
}

/** The store of the page, or null outside a page (the lyrics then show no strip). */
export function useReadingStore(): ReadingStore | null {
  return useContext(ReadingContext)
}

const EMPTY = new ReadingStore()

/** A value from the store; `select` must return something that compares with `===` (a number, a boolean). */
export function useReading<T>(select: (s: ReadingSnapshot) => T): T {
  const store = useContext(ReadingContext) ?? EMPTY
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.get()),
    () => select(store.get()),
  )
}
