import { useEffect, useId } from "react"
import { StyleSheet, View } from "react-native"

import { GuestSignInHost } from "@/components/guest/GuestSignInHost"
import { KirtanSafetyHost } from "@/components/kirtan/KirtanSafetyHost"
import { DownloadHost } from "@/components/offline/DownloadHost"
import { SaveToast } from "@/components/save/SaveToast"
import { SaveToSheet } from "@/components/save/SaveToSheet"
import { useSaveSheetStore } from "@/stores/saveSheetStore"

/**
 * Draws the one "Save to" sheet and its toast, the sign-in sheet for guests, and the download controls' prompt sheet and toast. Mount it once in the root layout. A native modal on
 * iOS (the full player) hides the root, so the player mounts its own: the host that mounted last
 * is the one that draws, and the root takes over again when the player closes.
 */
export function SaveHost() {
  const id = useId()
  const registerHost = useSaveSheetStore((s) => s.registerHost)
  const active = useSaveSheetStore((s) => s.hosts[s.hosts.length - 1] === id)
  const item = useSaveSheetStore((s) => s.item)
  const toast = useSaveSheetStore((s) => s.toast)
  const close = useSaveSheetStore((s) => s.close)
  useEffect(() => registerHost(id), [id, registerHost])
  if (!active) return null
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <SaveToSheet visible={item != null} item={item} onClose={close} />
      {toast ? <SaveToast message={toast.message} id={toast.id} /> : null}
      {/* asks a guest to sign in: the 3rd saved song, Upload, the comment box (docs/guest-saves.md) */}
      <GuestSignInHost />
      {/* the download controls' sign-in prompt, confirm sheet and toast */}
      <DownloadHost />
      {/* Report and Block this author of a Kiirtan or Bhajan */}
      <KirtanSafetyHost />
    </View>
  )
}
