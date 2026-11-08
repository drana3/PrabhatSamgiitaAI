import { useCallback, useEffect, useMemo, useState } from "react"
import { Modal, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import Svg, { Circle } from "react-native-svg"

import { KPress } from "@/components/kirtan/KPress"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import type { MyChords } from "@/hooks/useMyChords"
import { getActiveLanguage, useT } from "@/lib/i18n"
import { catalogSongsByNumbers } from "@/lib/lyricSearch"
import { chordFailure, chordsBackend } from "@/lib/songChords/backend"
import { shortDate } from "@/lib/songChords/charts"
import { draftFromWithdrawn } from "@/lib/songChords/draft"
import { bookIsFull, draftKey } from "@/lib/songChords/drafts"
import { actionHref, buildRows, menuActions, primaryAction, type ChartRow, type RowAction } from "@/lib/songChords/rows"
import { useChordDraftStore } from "@/stores/chordDraftStore"
import { href } from "@/utils/href"

import { ConfirmDialog, type DialogAction } from "./ConfirmDialog"
import { RowMenu } from "./RowMenu"
import { StatusChip } from "./StatusChip"
import { ActionButton, CORNER, Hint } from "./parts"

/**
 * "Your chord charts" on the Upload hub: ONE compact row for each chart, the ones sent to the team and the drafts kept
 * on this phone alike. A row is the song (number and title), a chip for where it stands (Draft, Waiting, Published,
 * Not accepted, Replaced), one line of facts, and a ⋯ menu. A tap on the row does the one thing the state is for; every other
 * action is in the menu. What each action does, asks and says is the table in docs/chord-proposals.md ("Actions of a
 * row"); the rules that decide it are pure and tested in lib/songChords/rows.ts.
 */
type Confirm = { action: "withdraw" | "delete" | "discardDraft" | "discardChanges"; row: ChartRow }
type Notice = { tone: "ok" | "error"; text: string }

export function MyCharts({ theme, chords, onChanged }: { theme: SongsTheme; chords: MyChords; onChanged?: () => void }) {
  const t = useT()
  const router = useRouter()
  const book = useChordDraftStore((s) => s.drafts)
  const discard = useChordDraftStore((s) => s.discard)
  const saveDraft = useChordDraftStore((s) => s.save)

  const rows = useMemo(() => buildRows(chords.items, book), [chords.items, book])
  const [menu, setMenu] = useState<ChartRow | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [why, setWhy] = useState<ChartRow | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  // a good notice goes away by itself; a problem stays until the member has read it
  useEffect(() => {
    if (!notice || notice.tone === "error") return undefined
    const id = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(id)
  }, [notice])

  // the Modal that holds the menu and the questions stays up for the length of their exit
  const anyOpen = menu !== null || confirm !== null || why !== null
  const [hosted, setHosted] = useState(false)
  useEffect(() => {
    if (anyOpen) {
      setHosted(true)
      return undefined
    }
    const id = setTimeout(() => setHosted(false), 260)
    return () => clearTimeout(id)
  }, [anyOpen])

  const run = useCallback(
    (action: RowAction, row: ChartRow) => {
      const to = actionHref(action, row)
      if (to) {
        router.push(href(to))
        return
      }
      if (action === "why") setWhy(row)
      else if (action === "withdraw" || action === "delete" || action === "discardDraft" || action === "discardChanges") setConfirm({ action, row })
    },
    [router],
  )

  const forgetDraftsOf = useCallback(
    (id: string) => {
      discard(`edit:${id}`)
      discard(`copy:${id}`)
    },
    [discard],
  )

  const doConfirm = useCallback(async () => {
    const current = confirm
    setConfirm(null)
    if (!current) return
    const { action, row } = current
    if (action === "discardDraft" || action === "discardChanges") {
      if (row.draft) discard(row.draft.key)
      setNotice({ tone: "ok", text: t(action === "discardDraft" ? "chordOffer.notice.draftDiscarded" : "chordOffer.notice.changesDiscarded") })
      return
    }
    const proposal = row.proposal
    const id = proposal?.id
    if (!proposal || !id) return
    // "Withdraw" does not delete: the chart goes back to the drafts on this phone, whole, and leaves the team's queue.
    // The draft is saved FIRST, so nothing can be lost between the two steps; if the server refuses, it is taken back.
    const kept = action === "withdraw" ? draftFromWithdrawn(proposal, row.draft?.draft ?? null) : null
    if (kept) {
      if (!(draftKey(kept) in book) && bookIsFull(book)) {
        setNotice({ tone: "error", text: t("chordOffer.failure.draftsFull") })
        return
      }
      saveDraft(kept)
    }
    try {
      await chordsBackend().remove(id)
      chords.drop(id)
      forgetDraftsOf(id)
      setNotice({ tone: "ok", text: t(action === "withdraw" ? "chordOffer.notice.withdrawn" : "chordOffer.deleted") })
      onChanged?.()
    } catch (error) {
      const failure = chordFailure(error)
      if (failure === "gone") {
        // somebody (this member on another phone) already removed it: the list should say so, too. A withdrawn chart's
        // draft stays: the chart is not with the team any more, and the work is the member's.
        chords.drop(id)
        forgetDraftsOf(id)
        onChanged?.()
        if (kept) {
          setNotice({ tone: "ok", text: t("chordOffer.notice.withdrawn") })
          return
        }
      } else if (kept) {
        discard(draftKey(kept))
      }
      setNotice({ tone: "error", text: t(`chordOffer.failure.${failure}` as "chordOffer.failure.server") })
    }
  }, [confirm, discard, saveDraft, book, chords, forgetDraftsOf, onChanged, t])

  // ---- states of the list ----
  const loading = (chords.status === "loading" || chords.status === "idle") && chords.items.length === 0
  const failed = chords.status === "error"

  const noticeBar = notice ? <NoticeBar theme={theme} notice={notice} onClose={() => setNotice(null)} /> : null

  let body: React.ReactNode
  if (rows.length === 0 && loading) body = <Hint theme={theme}>{t("upload.mine.loading")}</Hint>
  else if (rows.length === 0 && failed)
    body = (
      <View style={s.stack}>
        <Hint theme={theme} tone="danger">
          {t("upload.mine.error")}
        </Hint>
        <ActionButton theme={theme} tone="quiet" label={t("upload.mine.retry")} onPress={chords.reload} />
      </View>
    )
  else if (rows.length === 0)
    body = (
      <View style={[s.empty, { backgroundColor: theme.card, borderColor: theme.line }]}>
        <Text style={[s.emptyTitle, { color: theme.textHeading }]}>{t("upload.mine.empty.title")}</Text>
        <Text style={[s.emptyBody, { color: theme.textBody }]}>{t("upload.mine.empty")}</Text>
        <ActionButton theme={theme} label={t("upload.mine.empty.action")} onPress={() => router.push(href("/upload-chords"))} />
      </View>
    )
  else
    body = (
      <View style={s.list}>
        {failed ? (
          <View style={s.inline}>
            <Hint theme={theme} tone="danger">
              {t("upload.mine.error.some")}
            </Hint>
            <ActionButton theme={theme} tone="quiet" label={t("upload.mine.retry")} onPress={chords.reload} />
          </View>
        ) : null}
        {rows.map((row) => (
          <ChartRowView key={row.key} theme={theme} row={row} onPrimary={() => run(primaryAction(row), row)} onMenu={() => setMenu(row)} />
        ))}
      </View>
    )

  const menuItems = menu ? menuActions(menu).map((action) => ({ id: action, label: t(`chordOffer.action.${action}` as "chordOffer.action.edit"), tone: action === "delete" || action === "discardDraft" || action === "discardChanges" ? ("danger" as const) : undefined })) : []
  const titleOf = (row: ChartRow) => rowTitle(row.songId, t)

  const confirmCopy = confirm ? confirmTexts(confirm, t) : { title: "", body: "", yes: "", keep: "" }
  const confirmActions: DialogAction[] = [
    { label: confirmCopy.keep, tone: "quiet", onPress: () => setConfirm(null) },
    { label: confirmCopy.yes, tone: confirm?.action === "withdraw" ? "primary" : "danger", onPress: () => void doConfirm() },
  ]
  const whyReason = why?.proposal?.rejectedReason?.trim()
  const whyActions: DialogAction[] = [
    { label: t("common.close"), tone: "quiet", onPress: () => setWhy(null) },
    {
      label: t("upload.mine.fix"),
      tone: "primary",
      onPress: () => {
        const row = why
        setWhy(null)
        if (row) run("fix", row)
      },
    },
  ]

  return (
    <View style={s.stack}>
      {noticeBar}
      {body}
      <Modal visible={hosted} transparent animationType="none" onRequestClose={() => { setMenu(null); setConfirm(null); setWhy(null) }}>
        <View style={s.host} pointerEvents="box-none">
          <RowMenu
            theme={theme}
            open={menu !== null}
            title={menu ? titleOf(menu) : ""}
            subtitle={menu ? t(`chordOffer.status.long.${menu.kind}` as "chordOffer.status.long.draft") : undefined}
            items={menuItems}
            closeLabel={t("common.close")}
            onSelect={(id) => {
              const row = menu
              setMenu(null)
              if (row) run(id as RowAction, row)
            }}
            onDismiss={() => setMenu(null)}
          />
          <ConfirmDialog theme={theme} open={confirm !== null} title={confirmCopy.title} body={confirmCopy.body} actions={confirmActions} onDismiss={() => setConfirm(null)} />
          <ConfirmDialog
            theme={theme}
            open={why !== null}
            title={t("chordOffer.why.title")}
            body={whyReason ? t("chordOffer.rejectedWhy", { reason: whyReason }) : t("chordOffer.why.noReason")}
            actions={whyActions}
            onDismiss={() => setWhy(null)}
          />
        </View>
      </Modal>
    </View>
  )
}

/** "PS 7 · Title" (the title comes from the index that ships with the app, so it is there offline); "PS 7" without it. */
function rowTitle(songId: number | null, t: ReturnType<typeof useT>): string {
  if (!songId) return t("upload.drafts.noSong")
  const hit = catalogSongsByNumbers([songId], 1)[0]
  return hit?.title ? t("chordOffer.songTitle", { number: songId, title: hit.title }) : t("chordOffer.song", { number: songId })
}

function confirmTexts(confirm: Confirm, t: ReturnType<typeof useT>): { title: string; body: string; yes: string; keep: string } {
  const { action, row } = confirm
  if (action === "withdraw") return { title: t("chordOffer.withdraw.title"), body: t("chordOffer.withdraw.body"), yes: t("chordOffer.withdraw.yes"), keep: t("chordOffer.withdraw.keep") }
  if (action === "delete")
    return {
      title: t("chordOffer.delete.ask"),
      body: row.kind === "published" ? t("chordOffer.delete.ask.published") : row.kind === "replaced" ? t("chordOffer.delete.ask.replaced") : t("chordOffer.delete.ask.body"),
      yes: t("chordOffer.delete.yes"),
      keep: t("chordOffer.delete.keep"),
    }
  if (action === "discardChanges") return { title: t("chordOffer.changes.title"), body: t("chordOffer.changes.body"), yes: t("chordOffer.changes.yes"), keep: t("chordOffer.changes.keep") }
  const entry = row.draft
  const body = entry && entry.chords > 0 && entry.draft.songId ? t("chordOffer.discard.body", { count: entry.chords, number: entry.draft.songId }) : t("chordOffer.discard.bodyNoChords")
  return { title: t("chordOffer.discard.title"), body, yes: t("chordOffer.discard.yes"), keep: t("chordOffer.discard.keep") }
}

function Dots({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill={color}>
      <Circle cx={5} cy={12} r={2} />
      <Circle cx={12} cy={12} r={2} />
      <Circle cx={19} cy={12} r={2} />
    </Svg>
  )
}

function ChartRowView({ theme, row, onPrimary, onMenu }: { theme: SongsTheme; row: ChartRow; onPrimary: () => void; onMenu: () => void }) {
  const t = useT()
  const title = rowTitle(row.songId, t)
  const instrument = t(`chordOffer.instrument.${row.instrument}` as "chordOffer.instrument.guitar")
  const p = row.proposal
  let facts: string
  if (row.kind === "draft") facts = `${instrument} · ${t("chordOffer.chords.count", { count: row.draft?.chords ?? 0 })}`
  else if (row.kind === "replaced") facts = `${instrument} · ${t("chordOffer.row.replaced")}`
  else if (row.draft) facts = `${instrument} · ${t("chordOffer.row.changes")}`
  else {
    const detail = p?.instrument === "guitar" && p.capo > 0 ? `${instrument} · ${t("chordOffer.row.capo", { capo: p.capo })}` : instrument
    const date = p ? shortDate(p.createdAt, getActiveLanguage()) : ""
    facts = date ? `${detail} · ${date}` : detail
  }
  const label = `${title}. ${t(`chordOffer.status.long.${row.kind}` as "chordOffer.status.long.draft")}. ${facts}`
  return (
    <View style={[s.row, { backgroundColor: theme.card, borderColor: row.kind === "rejected" ? theme.dangerText : theme.line }]}>
      <KPress accessibilityRole="button" accessibilityLabel={label} accessibilityHint={t(`chordOffer.action.${primaryAction(row)}` as "chordOffer.action.edit")} onPress={onPrimary} pressedScale={0.99} outerStyle={s.mainOuter} style={s.main}>
        <Text style={[s.title, { color: theme.textHeading }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={s.line}>
          <StatusChip theme={theme} status={row.kind} />
          <Text style={[s.facts, { color: theme.textBody }]} numberOfLines={1}>
            {facts}
          </Text>
        </View>
      </KPress>
      <KPress accessibilityRole="button" accessibilityLabel={t("chordOffer.row.menu", { title })} onPress={onMenu} pressedScale={0.9} outerStyle={s.menuOuter} style={s.menu}>
        <Dots color={theme.textHeading} />
      </KPress>
    </View>
  )
}

/** One line that says what just happened, or what went wrong. Read out by screen readers; a good one fades by itself. */
function NoticeBar({ theme, notice, onClose }: { theme: SongsTheme; notice: Notice; onClose: () => void }) {
  const t = useT()
  const bad = notice.tone === "error"
  return (
    <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={[s.notice, { backgroundColor: bad ? "transparent" : theme.oliveBg, borderColor: bad ? theme.dangerText : theme.oliveBg }]}>
      <Text style={[s.noticeText, { color: bad ? theme.dangerText : theme.oliveText }]}>{notice.text}</Text>
      <KPress accessibilityRole="button" accessibilityLabel={t("common.close")} onPress={onClose} pressedScale={0.9} style={s.noticeClose}>
        <Text style={[s.noticeX, { color: bad ? theme.dangerText : theme.oliveText }]}>{"×"}</Text>
      </KPress>
    </View>
  )
}

const s = StyleSheet.create({
  stack: { gap: 12 },
  host: { flex: 1 },
  list: { gap: 8 },
  inline: { gap: 8 },
  empty: { borderWidth: 1.5, borderRadius: CORNER, padding: 16, gap: 12, alignItems: "stretch" },
  emptyTitle: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22 },
  emptyBody: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderRadius: CORNER, minHeight: 64 },
  mainOuter: { flex: 1, minWidth: 0 },
  main: { paddingLeft: 16, paddingVertical: 10, gap: 6, justifyContent: "center", minHeight: 62 },
  title: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  line: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  facts: { flexShrink: 1, fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  menuOuter: { width: 52, alignSelf: "stretch" },
  menu: { flex: 1, minHeight: 62, alignItems: "center", justifyContent: "center" },
  notice: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderRadius: CORNER, paddingLeft: 16, minHeight: 48 },
  noticeText: { flex: 1, fontFamily: amFonts.semi, fontSize: 14, lineHeight: 20, paddingVertical: 10 },
  noticeClose: { width: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  noticeX: { fontFamily: amFonts.bold, fontSize: 22, lineHeight: 24 },
})
