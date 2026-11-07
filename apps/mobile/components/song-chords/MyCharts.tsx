import { useMemo, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import Svg, { Path, Rect } from "react-native-svg"

import { KPress } from "@/components/kirtan/KPress"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import type { MyChords } from "@/hooks/useMyChords"
import { getActiveLanguage, useT } from "@/lib/i18n"
import { editHref, editMode, filterCharts, countByStatus, offerAnotherHref, shortDate, showFilters, sortForMember, type ChartFilter } from "@/lib/songChords/charts"
import { listDrafts, type DraftBook, type DraftEntry } from "@/lib/songChords/drafts"
import type { ChordProposal } from "@/lib/songChords/types"
import { keyLabel } from "@/lib/songPage/spChords"
import { href } from "@/utils/href"

import { ageLabel } from "./ageLabel"
import { StatusChip } from "./StatusChip"
import { ActionButton, CORNER, Chip, Hint, PILL } from "./parts"

/**
 * "Your chord charts" on the Upload hub, in every state: loading, could not load, empty, and a list with a chip for
 * where each chart stands, the reason when it was not accepted, and what the member can do with it (open the song,
 * edit, offer another version, delete). Pure rules (order, filters, edit or copy) are in lib/songChords/charts.ts.
 */
export function MyCharts({
  theme,
  chords,
  signedIn,
  onAskDelete,
  message,
}: {
  theme: SongsTheme
  chords: MyChords
  signedIn: boolean
  onAskDelete: (p: ChordProposal) => void
  message: string | null
}) {
  const t = useT()
  const router = useRouter()
  const [filter, setFilter] = useState<ChartFilter>("all")

  const sorted = useMemo(() => sortForMember(chords.items), [chords.items])
  const counts = useMemo(() => countByStatus(chords.items), [chords.items])
  const shown = useMemo(() => filterCharts(sorted, filter), [sorted, filter])
  const filters = showFilters(chords.items)

  if (!signedIn) return null
  if (chords.status === "loading" || chords.status === "idle") return <Hint theme={theme}>{t("upload.mine.loading")}</Hint>
  if (chords.status === "error" && chords.items.length === 0) {
    return (
      <View style={s.stack}>
        <Hint theme={theme} tone="danger">
          {t("upload.mine.error")}
        </Hint>
        <ActionButton theme={theme} tone="quiet" label={t("upload.mine.retry")} onPress={chords.reload} />
      </View>
    )
  }
  if (chords.items.length === 0) {
    return (
      <View style={[s.empty, { backgroundColor: theme.card, borderColor: theme.line }]}>
        <View style={[s.emptyIcon, { backgroundColor: theme.peach }]}>
          <Svg width={28} height={28} viewBox="0 0 32 32" fill="none">
            <Rect x={5} y={4} width={22} height={24} rx={3} stroke={theme.accent} strokeWidth={1.75} />
            <Path d="M5 12h22M5 20h22M13 4v24M20 4v24" stroke={theme.accent} strokeWidth={1.25} />
          </Svg>
        </View>
        <Text style={[s.emptyTitle, { color: theme.textHeading }]}>{t("upload.mine.empty.title")}</Text>
        <Text style={[s.emptyBody, { color: theme.textBody }]}>{t("upload.mine.empty")}</Text>
        <ActionButton theme={theme} label={t("upload.mine.empty.action")} onPress={() => router.push(href("/upload-chords"))} />
      </View>
    )
  }

  return (
    <View style={s.stack}>
      {chords.status === "error" ? (
        <Hint theme={theme} tone="danger">
          {t("upload.mine.error")}
        </Hint>
      ) : null}
      {message ? <Hint theme={theme}>{message}</Hint> : null}
      {filters ? (
        <View style={s.filters} accessibilityRole="radiogroup" accessibilityLabel={t("upload.filter.a11y")}>
          {(["all", "pending", "published", "rejected"] as const).map((f) => (
            <Chip key={f} theme={theme} label={`${t(`upload.filter.${f}` as "upload.filter.all")} ${counts[f]}`} on={filter === f} onPress={() => setFilter(f)} />
          ))}
        </View>
      ) : null}
      {shown.length === 0 ? <Hint theme={theme}>{t("upload.mine.filtered")}</Hint> : null}
      {shown.map((p) => (
        <ChartRow key={p.id} theme={theme} proposal={p} onAskDelete={onAskDelete} />
      ))}
      <ActionButton theme={theme} tone="quiet" label={t("upload.mine.offerMore")} onPress={() => router.push(href("/upload-chords"))} />
    </View>
  )
}

function Mini({ theme, label, onPress, tone = "quiet" }: { theme: SongsTheme; label: string; onPress: () => void; tone?: "quiet" | "danger" }) {
  return (
    <KPress
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      pressedScale={0.96}
      style={[s.mini, { borderColor: tone === "danger" ? theme.dangerText : theme.line, backgroundColor: theme.card }]}
    >
      <Text style={[s.miniText, { color: tone === "danger" ? theme.dangerText : theme.textHeading }]}>{label}</Text>
    </KPress>
  )
}

function ChartRow({ theme, proposal: p, onAskDelete }: { theme: SongsTheme; proposal: ChordProposal; onAskDelete: (p: ChordProposal) => void }) {
  const t = useT()
  const router = useRouter()
  const meta =
    p.instrument === "guitar"
      ? p.capo > 0
        ? t("chordOffer.meta.guitar", { capo: p.capo, key: keyLabel(p.baseKey) })
        : t("chordOffer.meta.guitarNoCapo", { key: keyLabel(p.baseKey) })
      : t("chordOffer.meta.harmonium", { key: keyLabel(p.baseKey) })
  const date = shortDate(p.createdAt, getActiveLanguage())
  const copy = editMode(p) === "copy"
  const open = () => router.push(href(`/song-v2/ps-${p.songId}`))
  const edit = () => router.push(href(editHref(p)))
  const help = p.status === "pending" ? t("chordOffer.status.pending.help") : p.status === "published" ? t("chordOffer.status.published.help") : null
  return (
    <View style={[s.row, { backgroundColor: theme.card, borderColor: p.status === "rejected" ? theme.dangerText : theme.line }]} accessibilityLabel={`${t("chordOffer.song", { number: p.songId })}. ${t(`chordOffer.status.${p.status}` as "chordOffer.status.pending")}`}>
      <View style={s.rowHead}>
        <Text style={[s.rowTitle, { color: theme.textHeading }]} numberOfLines={1}>
          {t("chordOffer.song", { number: p.songId })}
        </Text>
        <StatusChip theme={theme} status={p.status} />
      </View>
      <Text style={[s.rowMeta, { color: theme.textBody }]}>{meta}</Text>
      <Text style={[s.rowDate, { color: theme.textMuted }]}>
        {date ? t("upload.mine.sent", { date }) : ""}
        {p.isAnonymous ? `${date ? " · " : ""}${t("upload.mine.asAnonymous")}` : ""}
      </Text>
      {help ? <Hint theme={theme}>{help}</Hint> : null}
      {p.status === "rejected" ? (
        <View style={[s.reason, { borderColor: theme.dangerText }]} accessibilityLiveRegion="polite">
          {p.rejectedReason ? <Text style={[s.reasonText, { color: theme.dangerText }]}>{t("chordOffer.rejectedWhy", { reason: p.rejectedReason })}</Text> : null}
          <Text style={[s.reasonHelp, { color: theme.textBody }]}>{t("chordOffer.rejectedHelp")}</Text>
        </View>
      ) : null}
      {p.status === "rejected" ? <ActionButton theme={theme} label={t("upload.mine.fix")} onPress={edit} /> : null}
      <View style={s.actions}>
        <Mini theme={theme} label={t("upload.mine.open")} onPress={open} />
        {p.status !== "rejected" ? <Mini theme={theme} label={copy ? t("upload.mine.newVersion") : t("upload.mine.edit")} onPress={edit} /> : null}
        <Mini theme={theme} label={t("upload.mine.offerAnother")} onPress={() => router.push(href(offerAnotherHref(p)))} />
        <Mini theme={theme} tone="danger" label={t("chordOffer.delete")} onPress={() => onAskDelete(p)} />
      </View>
    </View>
  )
}

/** "Unfinished charts": the drafts kept on this phone. Nothing in here has been sent. */
export function DraftList({ theme, book, onAskDiscard }: { theme: SongsTheme; book: DraftBook; onAskDiscard: (entry: DraftEntry) => void }) {
  const t = useT()
  const router = useRouter()
  const entries = useMemo(() => listDrafts(book), [book])
  if (entries.length === 0) return null
  const now = Date.now()
  return (
    <View style={s.stack}>
      <Text style={[s.h2, { color: theme.textHeading }]} accessibilityRole="header">
        {t("upload.drafts.title")}
      </Text>
      <Hint theme={theme}>{t("upload.drafts.hint")}</Hint>
      {entries.map((e) => {
        const d = e.draft
        const title = d.songId ? t("chordOffer.song", { number: d.songId }) : t("upload.drafts.noSong")
        const kind = d.editId ? ` · ${t("chordOffer.title.fix")}` : d.basedOn ? ` · ${t("chordOffer.title.copy")}` : ""
        return (
          <View key={e.key} style={[s.row, { backgroundColor: theme.card, borderColor: theme.line }]}>
            <Text style={[s.rowTitle, { color: theme.textHeading }]} numberOfLines={1}>
              {title}
              {kind}
            </Text>
            <Text style={[s.rowMeta, { color: theme.textBody }]}>
              {t("upload.drafts.meta", {
                instrument: t(`chordOffer.instrument.${d.instrument}` as "chordOffer.instrument.guitar"),
                chords: t("chordOffer.chords.count", { count: e.chords }),
                when: ageLabel(t, e.updatedAt, now),
              })}
            </Text>
            <View style={s.actions}>
              <Mini theme={theme} label={t("upload.drafts.continue")} onPress={() => router.push(href(`/upload-chords?draft=${encodeURIComponent(e.key)}`))} />
              <Mini theme={theme} tone="danger" label={t("upload.drafts.discard")} onPress={() => onAskDiscard(e)} />
            </View>
          </View>
        )
      })}
    </View>
  )
}

const s = StyleSheet.create({
  stack: { gap: 12 },
  h2: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 26, letterSpacing: -0.3, textTransform: "uppercase" },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  empty: { borderWidth: 1.5, borderRadius: 24, padding: 24, gap: 12, alignItems: "stretch" },
  emptyIcon: { width: 56, height: 56, borderRadius: PILL, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: amFonts.bold, fontSize: 20, lineHeight: 26 },
  emptyBody: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22 },
  row: { borderWidth: 1.5, borderRadius: 24, padding: 16, gap: 8 },
  rowHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  rowTitle: { flexShrink: 1, fontFamily: amFonts.bold, fontSize: 18, lineHeight: 24 },
  rowMeta: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  rowDate: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  reason: { borderWidth: 1.5, borderRadius: CORNER, padding: 12, gap: 4 },
  reasonText: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 20 },
  reasonHelp: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  mini: { minHeight: 44, paddingHorizontal: 16, borderRadius: PILL, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  miniText: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 18 },
})
