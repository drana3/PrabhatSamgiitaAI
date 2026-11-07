import { Switch, StyleSheet, Text, View } from "react-native"
import { X } from "lucide-react-native"

import { KindMark } from "@/components/listening/KindMark"
import { Press } from "@/components/songs-v2/Press"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import type { HistoryEntry } from "@/lib/listening/history"
import { historySubline, historyTime } from "@/lib/listening/labels"
import { useT } from "@/lib/i18n"

const SIDE = 16

/** Group label: Today, Yesterday, Earlier. */
export function GroupLabel({ theme, label }: { theme: SongsTheme; label: string }) {
  return (
    <Text style={[s.group, { color: theme.accent }]} accessibilityRole="header">
      {label}
    </Text>
  )
}

/** One entry: kind mark, title, kind and author, time. Tap plays it again; the cross removes only this entry. */
export function HistoryRow({ theme, entry, onPlay, onRemove }: { theme: SongsTheme; entry: HistoryEntry; onPlay: (e: HistoryEntry) => void; onRemove: (e: HistoryEntry) => void }) {
  const t = useT()
  return (
    <View style={[s.row, { backgroundColor: theme.card, borderColor: theme.line }]}>
      <Press
        accessibilityRole="button"
        accessibilityLabel={t("history.again.a11y", { title: entry.title })}
        onPress={() => onPlay(entry)}
        pressedScale={0.985}
        outerStyle={s.main}
        style={s.mainIn}
      >
        <KindMark theme={theme} kind={entry.kind} />
        <View style={s.text}>
          <Text style={[s.title, { color: theme.textHeading }]} numberOfLines={2}>
            {entry.title}
          </Text>
          <Text style={[s.sub, { color: theme.textBody }]} numberOfLines={1}>
            {historySubline(entry)}
          </Text>
        </View>
        <Text style={[s.time, { color: theme.textMuted }]}>{historyTime(entry.at)}</Text>
      </Press>
      <Press accessibilityRole="button" accessibilityLabel={t("history.remove.a11y", { title: entry.title })} onPress={() => onRemove(entry)} pressedScale={0.88} style={s.cross}>
        <X size={18} color={theme.textBody} strokeWidth={1.9} />
      </Press>
    </View>
  )
}

/** The pause switch with its explanation. */
export function PauseRow({ theme, paused, onChange }: { theme: SongsTheme; paused: boolean; onChange: (paused: boolean) => void }) {
  const t = useT()
  return (
    <View style={[s.pause, { backgroundColor: theme.card, borderColor: theme.line }]}>
      <View style={s.pauseText}>
        <Text style={[s.pauseTitle, { color: theme.textHeading }]}>{t("history.pause")}</Text>
        <Text style={[s.pauseHint, { color: theme.textBody }]}>{t("history.pause.hint")}</Text>
      </View>
      <Switch
        accessibilityLabel={t("history.pause")}
        value={paused}
        onValueChange={onChange}
        trackColor={{ false: theme.line, true: theme.brand }}
        thumbColor={theme.onBrand}
      />
    </View>
  )
}

/** Nothing here: either nothing heard yet, or the history is paused. */
export function EmptyHistory({ theme, paused }: { theme: SongsTheme; paused: boolean }) {
  const t = useT()
  return (
    <View style={s.empty} accessibilityLiveRegion="polite">
      <Text style={[s.emptyTitle, { color: theme.textHeading }]}>{paused ? t("history.paused.title") : t("history.empty.title")}</Text>
      <Text style={[s.emptyBody, { color: theme.textBody }]}>{paused ? t("history.paused.body") : t("history.empty.body")}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  group: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase", paddingHorizontal: SIDE + 4, paddingTop: 22, paddingBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", marginHorizontal: SIDE, marginBottom: 10, borderRadius: 22, borderWidth: 1, overflow: "hidden" },
  main: { flex: 1 },
  mainIn: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingLeft: 12, paddingRight: 4, minHeight: 68 },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21 },
  sub: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
  time: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17, paddingRight: 2 },
  cross: { width: 44, height: 44, marginRight: 4, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  pause: { flexDirection: "row", alignItems: "center", gap: 14, marginHorizontal: SIDE, marginTop: 8, borderRadius: 22, borderWidth: 1, paddingVertical: 14, paddingLeft: 16, paddingRight: 14 },
  pauseText: { flex: 1, gap: 3 },
  pauseTitle: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21 },
  pauseHint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  empty: { paddingHorizontal: SIDE + 4, paddingTop: 40, gap: 8 },
  emptyTitle: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 28, letterSpacing: -0.4 },
  emptyBody: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 23 },
})
