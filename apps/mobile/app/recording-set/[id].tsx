import { useCallback, useEffect, useMemo, useState } from "react"
import { Alert, Platform, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { SheetTopBar } from "@/components/common/SheetTopBar"
import { KPress } from "@/components/kirtan/KPress"
import { Toast } from "@/components/songs-v2/Toast"
import { Reveal } from "@/components/today/motion"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useKirtanActions } from "@/hooks/useKirtanActions"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { formatDate, useT } from "@/lib/i18n"
import { canUseServer, remoteConfig } from "@/lib/kirtan/api"
import { RemoteError } from "@/lib/kirtan/remote"
import { deleteSet, fetchSet, patchSet, removeTrackFromSet, reorderSet, type RemoteSetDetail } from "@/lib/kirtan/remoteSets"
import { setShareText, swapIds, type Job } from "@/lib/kirtan/setPage"
import { viewOfDraft, viewOfRemote, whenLabel, type SetView } from "@/lib/kirtan/setView"
import type { Kirtan } from "@/lib/kirtan/types"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useAuthStore } from "@/stores/authStore"
import { useUploadSetStore } from "@/stores/uploadSetStore"
import { href } from "@/utils/href"

/**
 * One event playlist (docs/kiirtan-sets.md): title, date, place, who added it, the recordings in order, "Play all" and
 * Share. The owner also gets "Manage this playlist": rename, move a recording up or down, take one out, delete the
 * playlist (keeping or removing its recordings). Where the data comes from: the server's answer for everyone; the
 * phone's own copy while the set is still going up, and in the demo preview, which has no server (changes there are
 * not offered, the page says so).
 */

type Load = { kind: "loading" } | { kind: "ready"; detail: RemoteSetDetail } | { kind: "missing" } | { kind: "failed" }

export default function RecordingSetScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const actions = useKirtanActions()
  const bottomInset = useScrollBottomInset(24)
  const { id } = useLocalSearchParams<{ id: string }>()
  const setId = typeof id === "string" ? id : ""
  const memberId = useAuthStore((s) => s.memberId)
  const displayName = useAuthStore((s) => s.displayName)
  const drafts = useUploadSetStore((s) => s.drafts)
  const archive = useUploadSetStore((s) => s.archive)

  const [load, setLoad] = useState<Load>({ kind: "loading" })
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState("")
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)

  const active = drafts.find((draft) => draft.id === setId) ?? null
  const kept = archive.find((draft) => draft.id === setId) ?? null

  const fetchNow = useCallback(async () => {
    if (!setId) {
      setLoad({ kind: "missing" })
      return
    }
    if (MOCKUP_DATA) {
      setLoad(kept || active ? { kind: "loading" } : { kind: "missing" })
      return
    }
    setLoad((current) => (current.kind === "ready" ? current : { kind: "loading" }))
    try {
      setLoad({ kind: "ready", detail: await fetchSet(remoteConfig(), setId) })
    } catch (error) {
      setLoad(error instanceof RemoteError && (error.status === 404 || error.status === 403) ? { kind: "missing" } : { kind: "failed" })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId])
  useEffect(() => {
    void fetchNow()
  }, [fetchNow])

  const owner = displayName && displayName !== "Guest" ? displayName : ""
  // A set that is still going up shows the phone's copy (it is ahead of the server); otherwise the server's.
  const view: SetView | null = useMemo(() => {
    if (active) return viewOfDraft(active, owner)
    if (load.kind === "ready") return viewOfRemote(load.detail, memberId)
    if (kept) return viewOfDraft(kept, owner)
    return null
  }, [active, kept, load, memberId, owner])

  const mine = Boolean(view?.owner)
  const onServer = !MOCKUP_DATA && load.kind === "ready" && !active
  const canManage = mine && onServer && view?.state !== "removed"
  const close = () => (router.canGoBack() ? router.back() : router.replace(href("/kiirtan")))

  const play = (start?: number) => {
    if (!view || !view.tracks.length) return
    const first = view.tracks[start ?? 0]
    if (first) actions.open(first, view.tracks, view.title)
  }

  const share = async () => {
    if (!view) return
    const when = whenLabel(view, (day) => formatDate(day, "medium"), (from, to) => t("set.page.untilDay", { from, to }))
    const message = setShareText({ title: view.title, place: view.place, count: view.count, when }, (key, vars) => loose(t)(key, vars))
    try {
      await Share.share({ message })
    } catch {
      // closed by the person
    }
  }

  const ask = (heading: string, body: string, action: string, yes: () => void) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(`${heading}\n${body}`)) yes()
      return
    }
    Alert.alert(heading, body, [
      { text: t("set.own.cancel"), style: "cancel" },
      { text: action, style: "destructive", onPress: yes },
    ])
  }

  async function guarded(job: Job, doneText?: string) {
    if (busy) return
    setBusy(true)
    try {
      await job()
      if (doneText) actions.flash(doneText)
    } catch {
      actions.flash(t("set.own.failed"))
    } finally {
      setBusy(false)
    }
  }

  const rename = () => {
    const next = title.trim()
    if (!view || !next || next === view.title) return
    void guarded(async () => {
      await patchSet(remoteConfig(), view.id, { title: next })
      setLoad((current) => (current.kind === "ready" ? { kind: "ready", detail: { ...current.detail, title: next } } : current))
    }, t("set.own.saved"))
  }

  const move = (index: number, step: -1 | 1) => {
    if (!view || load.kind !== "ready") return
    const ids = swapIds(
      view.tracks.map(serverIdOf),
      index,
      step,
    )
    if (!ids) return
    const before = load.detail
    const byId = new Map(before.tracks.map((track) => [track.id, track]))
    const reordered = ids.flatMap((one) => byId.get(one) ?? [])
    const rest = before.tracks.filter((track) => !ids.includes(track.id))
    setLoad({ kind: "ready", detail: { ...before, tracks: [...reordered, ...rest] } })
    void guarded(async () => {
      try {
        const detail = await reorderSet(remoteConfig(), view.id, ids)
        setLoad({ kind: "ready", detail })
      } catch (error) {
        setLoad({ kind: "ready", detail: before })
        throw error
      }
    })
  }

  const takeOut = (trackId: string, trackTitle: string) =>
    ask(t("set.own.takeOutTitle"), `${trackTitle}\n${t("set.own.takeOutBody")}`, t("set.own.takeOutAction"), () => {
      if (!view) return
      void guarded(async () => {
        const detail = await removeTrackFromSet(remoteConfig(), view.id, trackId)
        setLoad({ kind: "ready", detail })
      })
    })

  const removeSet = (tracks: "keep" | "remove") => {
    if (!view) return
    void guarded(async () => {
      await deleteSet(remoteConfig(), view.id, tracks)
      router.replace(href("/my-sets"))
    })
  }

  const body = () => {
    if (!view) {
      if (load.kind === "loading") return <Text style={[styles.hint, { color: theme.textBody }]} accessibilityLiveRegion="polite">{t("set.page.loading")}</Text>
      return (
        <Reveal index={0} style={styles.stack}>
          <Text style={[styles.h1, { color: theme.textHeading }]} accessibilityRole="header">
            {t("set.page.notFound")}
          </Text>
          {load.kind === "failed" ? <Pill label={t("set.page.retry")} onPress={() => void fetchNow()} primary /> : null}
        </Reveal>
      )
    }
    const when = whenLabel(view, (day) => formatDate(day, "medium"), (from, to) => t("set.page.untilDay", { from, to }))
    return (
      <>
        <Reveal index={0} style={styles.stack}>
          <Text style={[styles.over, { color: theme.accent }]}>{[t(`set.status.${view.state}`), when].filter(Boolean).join(" · ")}</Text>
          <Text style={[styles.h1, { color: theme.textHeading }]} accessibilityRole="header">
            {view.title}
          </Text>
          {view.place ? <Text style={[styles.meta, { color: theme.textHeading }]}>{view.place}</Text> : null}
          <Text style={[styles.hint, { color: theme.textBody }]}>
            {[view.ownerName ? t("set.page.by", { name: view.ownerName }) : "", t("set.page.tracks", { count: view.count })].filter(Boolean).join(" · ")}
          </Text>
          {view.description ? <Text style={[styles.body, { color: theme.textBody }]}>{view.description}</Text> : null}
          {view.state === "removed" && view.removedReason ? (
            <Text style={[styles.hint, { color: theme.dangerText }]}>{t("set.page.removedNote", { reason: view.removedReason })}</Text>
          ) : null}
          <View style={styles.pills}>
            <Pill label={t("set.page.play")} onPress={() => play()} primary disabled={!view.tracks.length} />
            <Pill label={t("set.page.share")} onPress={() => void share()} />
            {canManage ? <Pill label={editing ? t("set.own.done") : t("set.own.edit")} onPress={() => setEditing((on) => !on)} /> : null}
          </View>
          {mine && MOCKUP_DATA ? <Text style={[styles.hint, { color: theme.textBody }]}>{t("set.own.demo")}</Text> : null}
        </Reveal>

        {editing && canManage ? (
          <Reveal index={1} style={styles.stack}>
            <Text style={[styles.label, { color: theme.textHeading }]}>{t("set.own.rename")}</Text>
            <View style={[styles.inputBox, { backgroundColor: theme.card, borderColor: theme.line }]}>
              <TextInput value={title} onChangeText={setTitle} maxLength={200} accessibilityLabel={t("set.own.rename")} placeholder={view.title} placeholderTextColor={theme.textMuted} style={[styles.input, { color: theme.textHeading }]} />
            </View>
            <View style={styles.pills}>
              <Pill label={t("set.own.save")} onPress={rename} primary disabled={busy || !title.trim() || title.trim() === view.title} />
              <Pill label={t("set.own.addTracks")} onPress={() => router.push(href(`/upload-set?set=${view.id}`))} />
            </View>
          </Reveal>
        ) : null}

        <Reveal index={2} style={styles.rows}>
          {view.tracks.length ? (
            view.tracks.map((track, index) => (
              <View key={track.id} style={[styles.row, { borderColor: theme.line, backgroundColor: theme.card }]}>
                <KPress accessibilityRole="button" accessibilityLabel={t("set.page.trackA11y", { n: index + 1, title: track.title })} onPress={() => play(index)} pressedScale={0.98} outerStyle={styles.rowMain} style={styles.rowInner}>
                  <Text style={[styles.number, { color: theme.ink300 }]}>{String(index + 1).padStart(2, "0")}</Text>
                  <Text style={[styles.rowTitle, { color: theme.textHeading }]} numberOfLines={2}>
                    {track.title}
                  </Text>
                </KPress>
                {editing && canManage ? (
                  <View style={styles.rowTools}>
                    <Tool label="↑" a11y={t("set.t.up", { title: track.title })} onPress={() => move(index, -1)} off={index === 0 || busy} theme={theme} />
                    <Tool label="↓" a11y={t("set.t.down", { title: track.title })} onPress={() => move(index, 1)} off={index === view.tracks.length - 1 || busy} theme={theme} />
                    <Tool label="×" a11y={t("set.own.takeOut", { title: track.title })} onPress={() => takeOut(serverIdOf(track), track.title)} off={busy} theme={theme} />
                  </View>
                ) : null}
              </View>
            ))
          ) : (
            <Text style={[styles.hint, { color: theme.textBody }]}>{t("set.page.empty")}</Text>
          )}
        </Reveal>

        {editing && canManage ? (
          <Reveal index={3} style={styles.stack}>
            {asking ? (
              <View style={[styles.card, { borderColor: theme.line, backgroundColor: theme.card }]}>
                <Text style={[styles.cardTitle, { color: theme.textHeading }]}>{t("set.own.deleteTitle")}</Text>
                <Text style={[styles.hint, { color: theme.textBody }]}>{t("set.own.deleteBody")}</Text>
                <Pill label={t("set.own.deleteKeep")} onPress={() => removeSet("keep")} primary disabled={busy} />
                <Pill label={t("set.own.deleteAll")} onPress={() => removeSet("remove")} danger disabled={busy} />
                <Text style={[styles.hint, { color: theme.dangerText }]}>{t("set.own.deleteAllWarn")}</Text>
                <Pill label={t("set.own.cancel")} onPress={() => setAsking(false)} />
              </View>
            ) : (
              <Pill label={t("set.own.delete")} onPress={() => setAsking(true)} danger />
            )}
          </Reveal>
        ) : null}
      </>
    )
  }

  useEffect(() => {
    if (editing && view) setTitle((current) => current || view.title)
  }, [editing, view])

  return (
    <View style={[styles.root, { backgroundColor: theme.page }]}>
      <SheetTopBar closeLabel={t("set.close")} onClose={close} />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}>
        {body()}
      </ScrollView>
      <Toast message={actions.toast} theme={theme} />
    </View>
  )
}

type Vars = { [name: string]: string | number }
/** `t` for a key that is picked at run time (the dictionary types its keys one by one). */
function loose(translate: unknown) {
  return translate as (key: string, vars: Vars) => string
}

/** The id the API knows a track by (the app's own id for a server row is `srv-<id>`). */
const serverIdOf = (track: Kirtan): string => track.serverId ?? track.id

function Pill({ label, onPress, primary, danger, disabled }: { label: string; onPress: () => void; primary?: boolean; danger?: boolean; disabled?: boolean }) {
  const theme = useSongsTheme()
  const background = primary ? amColors.orange700 : theme.card
  const color = primary ? "#FFFFFF" : danger ? theme.dangerText : theme.textHeading
  return (
    <KPress accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} pressedScale={0.97} style={[styles.pill, { backgroundColor: background, borderColor: primary ? background : theme.line, opacity: disabled ? 0.5 : 1 }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </KPress>
  )
}

function Tool({ label, a11y, onPress, off, theme }: { label: string; a11y: string; onPress: () => void; off: boolean; theme: ReturnType<typeof useSongsTheme> }) {
  return (
    <KPress accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ disabled: off }} disabled={off} onPress={onPress} pressedScale={0.92} style={[styles.tool, { borderColor: theme.line, opacity: off ? 0.35 : 1 }]}>
      <Text style={[styles.toolText, { color: theme.textHeading }]}>{label}</Text>
    </KPress>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 24, paddingTop: 8, maxWidth: 560, width: "100%", alignSelf: "center" },
  stack: { gap: 14 },
  over: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase" },
  h1: { fontFamily: amFonts.display, fontSize: 44, lineHeight: 46, letterSpacing: -0.9, textTransform: "uppercase" },
  meta: { fontFamily: amFonts.semi, fontSize: 17, lineHeight: 22 },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  body: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  pill: { minHeight: 48, paddingHorizontal: 22, borderRadius: 70, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  pillText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  inputBox: { minHeight: 56, borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 16, justifyContent: "center" },
  input: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, paddingVertical: 12, outlineStyle: "none" as never },
  rows: { gap: 10 },
  row: { borderRadius: 22, borderWidth: 1, flexDirection: "row", alignItems: "center", paddingRight: 8 },
  rowMain: { flex: 1, minWidth: 0 },
  rowInner: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingLeft: 16, paddingRight: 8, minHeight: 64 },
  number: { fontFamily: amFonts.display, fontSize: 20, lineHeight: 24, width: 30 },
  rowTitle: { flex: 1, fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21 },
  rowTools: { flexDirection: "row", gap: 6 },
  tool: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  toolText: { fontFamily: amFonts.bold, fontSize: 18, lineHeight: 22 },
  card: { borderRadius: 24, borderWidth: 1, padding: 16, gap: 12 },
  cardTitle: { fontFamily: amFonts.display, fontSize: 20, lineHeight: 24, textTransform: "uppercase" },
})
