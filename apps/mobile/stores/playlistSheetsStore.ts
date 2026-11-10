import type { MemberPlaylist } from "@prabhat/core"
import { router } from "expo-router"
import { Alert } from "react-native"
import { create } from "zustand"

import { t } from "@/lib/i18n"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { defaultPlaylistName } from "@/lib/playlists/playlistCover"
import { useAuthStore } from "@/stores/authStore"
import { usePlaylistStore } from "@/stores/playlistStore"
import { href } from "@/utils/href"

/**
 * Which playlist sheet is open: New playlist (name), Rename, Change photo, Delete (confirm) or the row menu.
 * One set of sheets for the whole app, drawn by components/playlists/PlaylistSheetsHost.tsx (mounted by SaveHost, so the
 * root and the full player both have it). Any screen asks with the helpers below; nobody builds its own name form.
 */
export type PlaylistSheetRequest =
  | { kind: "create"; defaultName: string; onCreated?: (playlist: MemberPlaylist) => void | Promise<void> }
  | { kind: "rename"; id: string }
  | { kind: "photo"; id: string }
  | { kind: "delete"; id: string; onDeleted?: () => void }
  | { kind: "menu"; id: string; onDeleted?: () => void }

type SheetsState = {
  request: PlaylistSheetRequest | null
  open: (request: PlaylistSheetRequest) => void
  close: () => void
}

export const usePlaylistSheetsStore = create<SheetsState>((set) => ({
  request: null,
  open: (request) => set({ request }),
  close: () => set({ request: null }),
}))

/** "New playlist": the name sheet, pre-filled with the next free default name. `onCreated` gets the new playlist (add the song, open it). */
export function askNewPlaylist(onCreated?: (playlist: MemberPlaylist) => void | Promise<void>): void {
  // playlists need an account: a guest is asked to sign in first, before typing a name
  if (!MOCKUP_DATA && useAuthStore.getState().mode !== "signed_in") {
    Alert.alert(t("library.signIn"), t("library.alert.body"), [
      { text: t("library.alert.notNow"), style: "cancel" },
      { text: t("library.signIn"), onPress: () => router.push(href("/signin")) },
    ])
    return
  }
  const existing = usePlaylistStore.getState().playlists
  const defaultName = defaultPlaylistName(existing, (n) => t("songs.playlistDefault", { n }))
  usePlaylistSheetsStore.getState().open({ kind: "create", defaultName, onCreated })
}

/** The "..." menu of a playlist: Rename, Change photo, Delete. */
export function openPlaylistMenu(id: string, onDeleted?: () => void): void {
  usePlaylistSheetsStore.getState().open({ kind: "menu", id, onDeleted })
}

export function openPlaylistRename(id: string): void {
  usePlaylistSheetsStore.getState().open({ kind: "rename", id })
}

export function openPlaylistPhoto(id: string): void {
  usePlaylistSheetsStore.getState().open({ kind: "photo", id })
}

export function openPlaylistDelete(id: string, onDeleted?: () => void): void {
  usePlaylistSheetsStore.getState().open({ kind: "delete", id, onDeleted })
}
