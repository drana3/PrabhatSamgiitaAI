import { useEffect, useRef } from "react"

import { GuestSignInSheet } from "@/components/guest/GuestSignInSheet"
import { SAVES_PROMPT_WAIT_MS, type GuestPromptKind } from "@/lib/guest/signInPrompt"
import { useAuthStore } from "@/stores/authStore"
import { useGuestPromptStore } from "@/stores/guestPromptStore"
import { usePlayerStore } from "@/stores/playerStore"
import { useSaveSheetStore } from "@/stores/saveSheetStore"

/** The Save sheet is still leaving the screen: a second sheet put up now can be lost by the system. */
const AFTER_SAVE_SHEET_MS = 380

/**
 * Draws the sign-in sheet for guests and decides WHEN (the rules are in lib/guest/signInPrompt.ts and
 * stores/guestPromptStore.ts). A request waits here for a quiet moment: the Save sheet closed, and for the
 * "saved songs" kind the music not playing (Dada: never during playback; it waits up to 90 seconds for a pause,
 * then lets go). Upload and comment come from a tap the guest just made, so they only wait for the Save sheet.
 * Mounted by SaveHost, so it is drawn by the same host as the Save sheet (the root, or the full player).
 */
export function GuestSignInHost() {
  const pending = useGuestPromptStore((s) => s.pending)
  const shown = useGuestPromptStore((s) => s.shown)
  const present = useGuestPromptStore((s) => s.present)
  const dropPending = useGuestPromptStore((s) => s.dropPending)
  const close = useGuestPromptStore((s) => s.close)
  const guest = useAuthStore((s) => s.mode === "guest")
  const saveSheetOpen = useSaveSheetStore((s) => s.item != null)
  const playing = usePlayerStore((s) => s.isPlaying)
  const last = useRef<GuestPromptKind>("saves")
  if (shown) last.current = shown.kind

  // a request that waited too long (the music kept playing) is dropped and does not count as shown
  useEffect(() => {
    if (!pending || pending.kind !== "saves") return
    const left = Math.max(0, SAVES_PROMPT_WAIT_MS - (Date.now() - pending.requestedAt))
    const timer = setTimeout(dropPending, left)
    return () => clearTimeout(timer)
  }, [pending, dropPending])

  useEffect(() => {
    if (!pending) return
    if (!guest) {
      dropPending()
      return
    }
    if (saveSheetOpen) return
    if (pending.kind === "saves" && playing) return
    const timer = setTimeout(() => present(), pending.kind === "saves" ? AFTER_SAVE_SHEET_MS : 0)
    return () => clearTimeout(timer)
  }, [pending, guest, saveSheetOpen, playing, present, dropPending])

  const onClose = () => {
    const after = close()
    // the sheet is on its way out; what follows (the Upload page) starts when it is mostly gone
    if (after) setTimeout(after, 280)
  }

  return <GuestSignInSheet visible={shown != null} kind={shown?.kind ?? last.current} onClose={onClose} />
}
