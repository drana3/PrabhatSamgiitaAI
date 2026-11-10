import { useEffect, useMemo, useRef, useState } from "react"
import { Alert, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native"
import { Check } from "lucide-react-native"
import { useRouter } from "expo-router"

import { SpringSheet } from "@/components/assistant-v2/SpringSheet"
import { useKeyboardHeight } from "@/components/kirtan/add/TagPicker"
import { CoverTile, coverPhoto } from "@/components/playlists/PlaylistCover"
import { PillButton } from "@/components/songs-v2/Pill"
import { Press } from "@/components/songs-v2/Press"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { controlBorder } from "@/lib/controlColors"
import { useT } from "@/lib/i18n"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { cleanPlaylistName, coverChoices, resolveCover } from "@/lib/playlists/playlistCover"
import { usePlaylistCoverStore } from "@/stores/playlistCoverStore"
import { usePlaylistSheetsStore, type PlaylistSheetRequest } from "@/stores/playlistSheetsStore"
import { isPlaylist, usePlaylistStore } from "@/stores/playlistStore"
import { useSaveSheetStore } from "@/stores/saveSheetStore"
import { href } from "@/utils/href"

/** Time a closing sheet needs to leave before the next one comes up (two native modals must not change places at once). */
const HAND_OFF_MS = 280

/**
 * The playlist sheets, one set for the whole app (stores/playlistSheetsStore.ts): New playlist (name, with a default
 * already typed and selected), Rename, Change photo (a grid of 12 photos of the library and "Shuffle another"), Delete
 * (a confirmation that says the songs stay) and the row menu that leads to the other three. White SpringSheet, the
 * ChoiceField look for the rows (outline from controlBorder, so it shows in Dark too).
 */
export function PlaylistSheetsHost() {
  const request = usePlaylistSheetsStore((s) => s.request)
  const close = usePlaylistSheetsStore((s) => s.close)
  const open = usePlaylistSheetsStore((s) => s.open)
  // keep the last request while a sheet slides out, so its content does not vanish mid-animation
  const last = useRef<PlaylistSheetRequest | null>(null)
  if (request) last.current = request
  const shown = request ?? last.current
  const is = (kind: PlaylistSheetRequest["kind"]) => request?.kind === kind

  const handOff = (next: PlaylistSheetRequest) => {
    close()
    setTimeout(() => open(next), HAND_OFF_MS)
  }

  return (
    <>
      <NameSheet visible={is("create")} request={shown?.kind === "create" ? shown : null} onClose={close} />
      <NameSheet visible={is("rename")} request={shown?.kind === "rename" ? shown : null} onClose={close} />
      <PhotoSheet visible={is("photo")} id={shown?.kind === "photo" ? shown.id : null} onClose={close} />
      <DeleteSheet visible={is("delete")} request={shown?.kind === "delete" ? shown : null} onClose={close} />
      <MenuSheet
        visible={is("menu")}
        request={shown?.kind === "menu" ? shown : null}
        onClose={close}
        onRename={(id) => handOff({ kind: "rename", id })}
        onPhoto={(id) => handOff({ kind: "photo", id })}
        onDelete={(id, onDeleted) => handOff({ kind: "delete", id, onDeleted })}
      />
    </>
  )
}

/** A person who is not signed in cannot make or change playlists: the same ask the other playlist screens make. */
function useAskSignIn(onClose: () => void) {
  const t = useT()
  const router = useRouter()
  return () => {
    onClose()
    Alert.alert(t("library.signIn"), t("library.alert.body"), [
      { text: t("library.alert.notNow"), style: "cancel" },
      { text: t("library.signIn"), onPress: () => router.push(href("/signin")) },
    ])
  }
}

function previewToast(t: ReturnType<typeof useT>) {
  useSaveSheetStore.getState().showToast(t("library.toast.preview"))
}

/** New playlist and Rename share one sheet: a name field and one button. */
function NameSheet({ visible, request, onClose }: { visible: boolean; request: Extract<PlaylistSheetRequest, { kind: "create" | "rename" }> | null; onClose: () => void }) {
  const t = useT()
  const am = useAmTheme()
  const theme = useSongsTheme()
  const keyboard = useKeyboardHeight(visible)
  const askSignIn = useAskSignIn(onClose)
  const renaming = request?.kind === "rename"
  const current = usePlaylistStore((s) => (request?.kind === "rename" ? s.playlists.find((p) => p.id === request.id)?.name : undefined))
  const initial = request?.kind === "create" ? request.defaultName : (current ?? "")
  const [name, setName] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // a fresh name (and no old error) every time the sheet opens
  useEffect(() => {
    if (visible) {
      setName(initial)
      setError(null)
      setBusy(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when it opens
  }, [visible])

  const submit = async () => {
    if (busy || !request) return
    const clean = cleanPlaylistName(name)
    if (!clean) return setError(t("pl.name.empty"))
    if (MOCKUP_DATA) {
      onClose()
      return previewToast(t)
    }
    setBusy(true)
    const store = usePlaylistStore.getState()
    if (request.kind === "create") {
      const created = await store.createPlaylist(clean)
      setBusy(false)
      if (isPlaylist(created)) {
        onClose()
        void store.flushSync()
        void request.onCreated?.(created)
        return
      }
      if ("needsAuth" in created) return askSignIn()
      return setError(created.error)
    }
    const renamed = await store.renamePlaylist(request.id, clean)
    setBusy(false)
    if (isPlaylist(renamed)) {
      onClose()
      void store.flushSync()
      return
    }
    if ("needsAuth" in renamed) return askSignIn()
    setError(renamed.error)
  }

  return (
    <SpringSheet visible={visible} onClose={onClose} title={renaming ? t("pl.rename.title") : t("songs.mine.newPlaylist")} theme={am}>
      <View style={[styles.body, { paddingBottom: keyboard }]}>
        {!renaming ? <Text style={[styles.hint, { color: theme.textBody }]}>{t("pl.new.hint")}</Text> : null}
        <TextInput
          value={name}
          onChangeText={(value) => {
            setName(value)
            setError(null)
          }}
          placeholder={t("songs.mine.listName")}
          placeholderTextColor={theme.textMuted}
          accessibilityLabel={t("songs.mine.listName")}
          autoFocus
          selectTextOnFocus
          maxLength={120}
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
          style={[styles.input, { color: theme.textHeading, borderColor: error ? amColors.danger : controlBorder(theme), backgroundColor: theme.card }]}
        />
        {error ? (
          <Text style={[styles.error, { color: theme.dangerText }]} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <PillButton theme={theme} label={renaming ? t("common.save") : t("songs.mine.create")} disabled={busy || !cleanPlaylistName(name)} onPress={() => void submit()} />
      </View>
    </SpringSheet>
  )
}

/** Change photo: 12 photos of the library in a grid, the current one first and marked; "Shuffle another" brings 12 more. */
function PhotoSheet({ visible, id, onClose }: { visible: boolean; id: string | null; onClose: () => void }) {
  const t = useT()
  const am = useAmTheme()
  const theme = useSongsTheme()
  const { width } = useWindowDimensions()
  const chosen = usePlaylistCoverStore((s) => (id ? resolveCover(id, s.covers[id]) : 0))
  // the grid is laid out from the photo that was current when it was opened or shuffled, so a tap never reorders it under the finger
  const [base, setBase] = useState(chosen)
  const [round, setRound] = useState(0)
  useEffect(() => {
    if (visible) {
      setBase(chosen)
      setRound(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when it opens
  }, [visible, id])
  const choices = useMemo(() => coverChoices(base, round), [base, round])
  const COLS = 4
  const GAP = 8
  const tile = Math.floor((width - 20 - 20 - GAP * (COLS - 1)) / COLS)

  const pick = (photo: number) => {
    if (id) usePlaylistCoverStore.getState().set(id, photo)
  }
  const shuffle = () => {
    setBase(chosen)
    setRound((r) => r + 1)
  }

  return (
    <SpringSheet visible={visible} onClose={onClose} title={t("pl.photo.title")} theme={am}>
      <View style={styles.body}>
        <Text style={[styles.hint, { color: theme.textBody }]}>{t("pl.photo.hint")}</Text>
        <ScrollView contentContainerStyle={[styles.grid, { gap: GAP }]} showsVerticalScrollIndicator={false}>
          {choices.map((photo) => {
            const on = photo === chosen
            return (
              <Press
                key={photo}
                accessibilityRole="button"
                accessibilityLabel={t("pl.photo.item", { title: coverPhoto(photo).title })}
                accessibilityState={{ selected: on }}
                onPress={() => pick(photo)}
                pressedScale={0.96}
                style={[styles.tile, { width: tile, height: tile, borderColor: on ? theme.brand : "transparent" }]}
              >
                <CoverTile photo={photo} size={tile - 6} radius={9} />
                {on ? (
                  <View style={[styles.check, { backgroundColor: theme.brand }]}>
                    <Check size={14} color={theme.onBrand} />
                  </View>
                ) : null}
              </Press>
            )
          })}
        </ScrollView>
        <PillButton theme={theme} tone="sand" label={t("pl.photo.shuffle")} onPress={shuffle} />
      </View>
    </SpringSheet>
  )
}

/** Delete: says what goes (the playlist) and what stays (the songs), then Delete or Cancel. */
function DeleteSheet({ visible, request, onClose }: { visible: boolean; request: Extract<PlaylistSheetRequest, { kind: "delete" }> | null; onClose: () => void }) {
  const t = useT()
  const am = useAmTheme()
  const theme = useSongsTheme()
  const askSignIn = useAskSignIn(onClose)
  const name = usePlaylistStore((s) => (request ? s.playlists.find((p) => p.id === request.id)?.name : undefined)) ?? ""
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    if (!request || busy) return
    if (MOCKUP_DATA) {
      onClose()
      return previewToast(t)
    }
    setBusy(true)
    const result = await usePlaylistStore.getState().deletePlaylist(request.id)
    setBusy(false)
    if ("ok" in result) {
      onClose()
      void usePlaylistStore.getState().flushSync()
      request.onDeleted?.()
      return
    }
    if ("needsAuth" in result) return askSignIn()
    onClose()
    Alert.alert(t("playlist.delete"), result.error)
  }

  return (
    <SpringSheet visible={visible} onClose={onClose} title={t("pl.menu.delete")} theme={am}>
      <View style={styles.body}>
        <Text style={[styles.confirmTitle, { color: theme.textHeading }]}>{t("pl.delete.title", { name })}</Text>
        <Text style={[styles.hint, { color: theme.textBody }]}>{t("pl.delete.body")}</Text>
        <PillButton theme={theme} tone="danger" label={t("playlist.delete.confirm")} disabled={busy} onPress={() => void confirm()} />
        <PillButton theme={theme} tone="sand" label={t("common.cancel")} onPress={onClose} />
      </View>
    </SpringSheet>
  )
}

function ActionRow({ theme, label, danger, onPress }: { theme: SongsTheme; label: string; danger?: boolean; onPress: () => void }) {
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      pressedScale={0.98}
      style={[styles.action, { borderColor: controlBorder(theme), backgroundColor: theme.card }]}
    >
      <Text style={[styles.actionLabel, { color: danger ? theme.dangerText : theme.textHeading }]}>{label}</Text>
    </Press>
  )
}

/** The "..." menu of a playlist row. */
function MenuSheet({
  visible,
  request,
  onClose,
  onRename,
  onPhoto,
  onDelete,
}: {
  visible: boolean
  request: Extract<PlaylistSheetRequest, { kind: "menu" }> | null
  onClose: () => void
  onRename: (id: string) => void
  onPhoto: (id: string) => void
  onDelete: (id: string, onDeleted?: () => void) => void
}) {
  const t = useT()
  const am = useAmTheme()
  const theme = useSongsTheme()
  const name = usePlaylistStore((s) => (request ? s.playlists.find((p) => p.id === request.id)?.name : undefined)) ?? ""
  const id = request?.id ?? ""
  return (
    <SpringSheet visible={visible} onClose={onClose} title={name || t("player.playlist")} theme={am}>
      <View style={styles.body}>
        <ActionRow theme={theme} label={t("pl.menu.rename")} onPress={() => onRename(id)} />
        <ActionRow theme={theme} label={t("pl.menu.photo")} onPress={() => onPhoto(id)} />
        <ActionRow theme={theme} label={t("pl.menu.delete")} danger onPress={() => onDelete(id, request?.onDeleted)} />
      </View>
    </SpringSheet>
  )
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 10, paddingBottom: 8, gap: 12 },
  hint: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 21 },
  input: { height: 52, borderRadius: 70, borderWidth: 1, paddingHorizontal: 20, fontFamily: amFonts.semi, fontSize: 17 },
  error: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingBottom: 4 },
  tile: { borderWidth: 3, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  check: { position: "absolute", right: 6, bottom: 6, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  confirmTitle: { fontFamily: amFonts.bold, fontSize: 19, lineHeight: 24 },
  action: { minHeight: 56, borderRadius: 20, borderWidth: 1, paddingHorizontal: 20, justifyContent: "center" },
  actionLabel: { fontFamily: amFonts.semi, fontSize: 17, lineHeight: 22 },
})
