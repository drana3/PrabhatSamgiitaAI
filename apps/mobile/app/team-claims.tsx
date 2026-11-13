import { useCallback, useEffect, useRef, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { DeskGroupCard } from "@/components/authors/DeskParts"
import { KPress } from "@/components/kirtan/KPress"
import { ActionButton, CORNER, Chip, Hint, PILL } from "@/components/song-chords/parts"
import { amFonts } from "@/constants/tokens/amTypography"
import { useScreenTop } from "@/hooks/useScreenTop"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import {
  DESK_TABS,
  EMPTY_SUMMARY,
  UNDO,
  deskReasonKey,
  groupByPage,
  reasonChips,
  setMany,
  toggled,
  type DeskAction,
  type DeskClaim,
  type DeskStatus,
  type DeskSummary,
} from "@/lib/authors/desk"
import { claimsDesk, deskFailure } from "@/lib/authors/deskApi"
import { useT } from "@/lib/i18n"
import { badgeLabel } from "@/lib/teamReview/rules"
import { href } from "@/utils/href"

type Status = "loading" | "ready" | "error" | "offline" | "denied"
type Undo = { ids: string[]; action: DeskAction; changed: number }

/**
 * The team's desk for author claims: the requests the system could not approve by itself, grouped by author page. Four
 * tabs (waiting, approved, declined, taken off), a chip row of the reasons a waiting request came to the team, ticks to
 * pick requests (also across pages) and one decision for the whole pick, or one decision per page. Every decision can
 * be undone for a few seconds (the request goes back to waiting and nobody is told). Team only: the server decides.
 * Opened from the Upload hub's team row (docs/author-profiles.md, "The team desk").
 */
export default function TeamClaimsScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const top = useScreenTop()
  const clear = useScrollBottomInset()
  const [tab, setTab] = useState<DeskStatus>("pending")
  const [reason, setReason] = useState<string | null>(null)
  const [state, setState] = useState<{ status: Status; items: DeskClaim[]; total: number }>({ status: "loading", items: [], total: 0 })
  const [summary, setSummary] = useState<DeskSummary>(EMPTY_SUMMARY)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [reload, setReload] = useState(0)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [undo, setUndo] = useState<Undo | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshSummary = useCallback(() => {
    claimsDesk()
      .summary()
      .then(setSummary)
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    let active = true
    setState((s0) => ({ ...s0, status: "loading" }))
    claimsDesk()
      .list(tab, tab === "pending" ? reason : null)
      .then((page) => {
        if (active) setState({ status: "ready", items: page.items, total: page.total })
      })
      .catch((error: unknown) => {
        if (!active) return
        const failure = deskFailure(error)
        setState({ status: failure === "denied" ? "denied" : failure === "network" ? "offline" : "error", items: [], total: 0 })
      })
    return () => {
      active = false
    }
  }, [tab, reason, reload])
  useEffect(() => refreshSummary(), [refreshSummary])
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const showNotice = useCallback((text: string, undoable: Undo | null) => {
    if (timer.current) clearTimeout(timer.current)
    setNotice(text)
    setUndo(undoable)
    timer.current = setTimeout(() => {
      setNotice(null)
      setUndo(null)
    }, 8000)
  }, [])

  const decide = useCallback(
    async (ids: string[], action: DeskAction) => {
      if (!ids.length || busy) return
      setBusy(true)
      setProblem(null)
      try {
        const changed = await claimsDesk().decide(ids, action)
        setSelected((s0) => setMany(s0, ids, false))
        setState((s0) => ({ ...s0, items: s0.items.filter((i) => !ids.includes(i.id)), total: Math.max(0, s0.total - ids.length) }))
        refreshSummary()
        if (changed === 0) showNotice(t("claimsDesk.done.none"), null)
        else showNotice(t(`claimsDesk.done.${action}` as "claimsDesk.done.approve", { count: changed }), action === UNDO ? null : { ids, action, changed })
      } catch (error) {
        const failure = deskFailure(error)
        if (failure === "conflict") setReload((n) => n + 1)
        setProblem(t(failure === "network" ? "claimsDesk.failed.offline" : "claimsDesk.failed"))
      } finally {
        setBusy(false)
      }
    },
    [busy, refreshSummary, showNotice, t],
  )

  const undoLast = useCallback(async () => {
    if (!undo || busy) return
    const { ids } = undo
    setBusy(true)
    try {
      const changed = await claimsDesk().decide(ids, UNDO)
      refreshSummary()
      setReload((n) => n + 1)
      showNotice(t("claimsDesk.undone", { count: changed }), null)
    } catch {
      setProblem(t("claimsDesk.failed"))
    } finally {
      setBusy(false)
    }
  }, [busy, refreshSummary, showNotice, t, undo])

  const groups = groupByPage(state.items)
  const pickedHere = state.items.filter((i) => selected.has(i.id)).map((i) => i.id)
  const bulkActions = tab === "pending" ? (["approve", "reject"] as const) : tab === "approved" ? (["revoke"] as const) : (["approve"] as const)
  const chips = reasonChips(summary)

  return (
    <View style={[s.root, { backgroundColor: theme.page }]}>
      <View style={[s.bar, { paddingTop: top }]}>
        <KPress accessibilityRole="button" accessibilityLabel={t("common.back")} onPress={() => (router.canGoBack() ? router.back() : router.replace(href("/upload")))} pressedScale={0.95} style={[s.back, { borderColor: theme.line, backgroundColor: theme.card }]}>
          <Text style={[s.backText, { color: theme.textHeading }]}>{t("common.back")}</Text>
        </KPress>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.content, { paddingBottom: clear + (pickedHere.length || notice ? 168 : 48) }]}>
        <View>
          <Text style={[s.over, { color: theme.accent }]}>{t("claimsDesk.over")}</Text>
          <Text style={[s.h1, { color: theme.textHeading }]} accessibilityRole="header">
            {t("claimsDesk.title")}
          </Text>
        </View>
        <Hint theme={theme}>{t("claimsDesk.lead")}</Hint>

        <View style={s.chips} accessibilityRole="tablist" accessibilityLabel={t("claimsDesk.tabs.a11y")}>
          {DESK_TABS.map((id) => {
            const badge = badgeLabel(summary[id])
            const label = t(`claimsDesk.tab.${id}` as "claimsDesk.tab.pending")
            return (
              <Chip
                key={id}
                theme={theme}
                role="radio"
                label={badge ? `${label}  ${badge}` : label}
                a11y={badge ? `${label}, ${t("claimsDesk.badge", { count: summary[id] })}` : label}
                on={tab === id}
                onPress={() => {
                  setTab(id)
                  setReason(null)
                  setSelected(new Set())
                }}
              />
            )
          })}
        </View>
        {tab === "pending" && chips.length ? (
          <View style={s.chips} accessibilityRole="tablist" accessibilityLabel={t("claimsDesk.reasons.a11y")}>
            <Chip theme={theme} label={t("claimsDesk.reason.all")} on={reason === null} onPress={() => setReason(null)} />
            {chips.map((chip) => (
              <Chip key={chip.reason} theme={theme} label={`${t(deskReasonKey(chip.reason) as "claimsDesk.reason.other")}  ${chip.count}`} a11y={t(deskReasonKey(chip.reason) as "claimsDesk.reason.other")} on={reason === chip.reason} onPress={() => setReason(chip.reason)} />
            ))}
          </View>
        ) : null}
        {state.items.length > 1 ? (
          <View style={s.chips}>
            <Chip theme={theme} role="button" label={pickedHere.length === state.items.length ? t("claimsDesk.select.none") : t("claimsDesk.select.all")} on={pickedHere.length === state.items.length} onPress={() => setSelected((s0) => setMany(s0, state.items.map((i) => i.id), pickedHere.length !== state.items.length))} />
          </View>
        ) : null}

        {state.status === "loading" && state.items.length === 0 ? <Hint theme={theme}>{t("claimsDesk.loading")}</Hint> : null}
        {state.status === "denied" ? <Hint theme={theme} tone="danger">{t("claimsDesk.denied")}</Hint> : null}
        {state.status === "error" || state.status === "offline" ? (
          <View style={s.gap}>
            <Hint theme={theme} tone="danger">{t(state.status === "offline" ? "claimsDesk.offline" : "claimsDesk.error")}</Hint>
            <ActionButton theme={theme} tone="quiet" label={t("claimsDesk.retry")} onPress={() => setReload((n) => n + 1)} />
          </View>
        ) : null}
        {state.status === "ready" && state.items.length === 0 ? <Hint theme={theme}>{t(`claimsDesk.empty.${tab}` as "claimsDesk.empty.pending")}</Hint> : null}
        {problem ? <Hint theme={theme} tone="danger">{problem}</Hint> : null}

        {groups.map((group) => (
          <DeskGroupCard
            key={group.profileId}
            theme={theme}
            group={group}
            status={tab}
            selected={selected}
            busy={busy}
            onToggle={(id) => setSelected((s0) => toggled(s0, id))}
            onToggleGroup={(ids, on) => setSelected((s0) => setMany(s0, ids, on))}
            onDecide={(ids, action) => void decide(ids, action)}
          />
        ))}
        {state.total > state.items.length ? <Hint theme={theme}>{t("claimsDesk.more", { count: state.items.length })}</Hint> : null}

        <View style={[s.note, { borderColor: theme.line }]}>
          <Text style={[s.noteTitle, { color: theme.textHeading }]}>{t("claimsDesk.note.title")}</Text>
          <Hint theme={theme}>{t("claimsDesk.note.body")}</Hint>
        </View>
      </ScrollView>

      {pickedHere.length || notice ? (
        <View style={[s.dock, { bottom: clear, backgroundColor: theme.card, borderColor: theme.line }]} testID="desk-dock">
          {notice ? (
            <View style={s.noticeRow} accessibilityLiveRegion="polite">
              <Text style={[s.noticeText, { color: theme.textHeading }]}>{notice}</Text>
              {undo ? (
                <KPress accessibilityRole="button" accessibilityLabel={t("claimsDesk.undo")} onPress={() => void undoLast()} pressedScale={0.95} style={[s.undo, { borderColor: theme.accent }]}>
                  <Text style={[s.undoText, { color: theme.accent }]}>{t("claimsDesk.undo")}</Text>
                </KPress>
              ) : null}
            </View>
          ) : null}
          {pickedHere.length ? (
            <>
              <Text style={[s.noticeText, { color: theme.textBody }]}>{t("claimsDesk.select.count", { count: pickedHere.length })}</Text>
              <View style={s.row}>
                {bulkActions.map((action, index) => (
                  <ActionButton key={action} theme={theme} tone={index === 0 ? "primary" : "quiet"} label={t(`claimsDesk.bulk.${action}` as "claimsDesk.bulk.approve")} disabled={busy} busy={busy} onPress={() => void decide(pickedHere, action)} style={s.half} />
                ))}
              </View>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  bar: { paddingHorizontal: 24, paddingBottom: 6, flexDirection: "row" },
  back: { minHeight: 44, paddingHorizontal: 16, borderRadius: PILL, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  backText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  content: { paddingHorizontal: 24, gap: 16, paddingTop: 12, maxWidth: 560, width: "100%", alignSelf: "center" },
  over: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase", marginBottom: 6 },
  h1: { fontFamily: amFonts.display, fontSize: 45, lineHeight: 45, letterSpacing: -0.9, textTransform: "uppercase" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  gap: { gap: 8 },
  row: { flexDirection: "row", gap: 8 },
  half: { flex: 1 },
  note: { borderTopWidth: 1.5, paddingTop: 16, gap: 8 },
  noteTitle: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  dock: { position: "absolute", left: 16, right: 16, borderWidth: 1.5, borderRadius: CORNER, padding: 12, gap: 8, maxWidth: 560, alignSelf: "center" },
  noticeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  noticeText: { flex: 1, fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  undo: { minHeight: 44, paddingHorizontal: 16, borderRadius: PILL, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  undoText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
})
