import { getActiveLanguage, translatorFor } from "@/lib/i18n"
import { nowMs } from "@/lib/notifications/clock"
import { useNotificationsStore } from "@/stores/notificationsStore"
import { useChordNoticeStore } from "@/stores/chordNoticeStore"

import { chordsBackend } from "./backend"
import { chordNotices } from "./notices"
import type { ChordProposal } from "./types"

/**
 * Feed the member's chord charts into the notification centre. Called with a list that was just loaded (the Upload hub
 * has one) or, with `syncChordNotices`, after loading it. Additive: it only adds items to the inbox through the store's
 * own `receive`; the inbox screen is not touched. Never throws (a notice that cannot be made is not worth a crash).
 */
export function ingestMine(mine: readonly ChordProposal[]): number {
  try {
    const t = translatorFor(getActiveLanguage())
    const seen = { statuses: useChordNoticeStore.getState().statuses }
    const result = chordNotices(
      seen,
      mine,
      nowMs(),
      (key, params) => (t as unknown as (k: string, p?: Record<string, string | number>) => string)(key, params),
      { guitar: t("chordOffer.instrument.guitar"), harmonium: t("chordOffer.instrument.harmonium") },
    )
    useChordNoticeStore.getState().setSeen(result.seen)
    if (result.notices.length) useNotificationsStore.getState().receive(result.notices, nowMs())
    return result.notices.length
  } catch {
    return 0
  }
}

export async function syncChordNotices(): Promise<number> {
  try {
    return ingestMine(await chordsBackend().mine())
  } catch {
    return 0
  }
}
