import { useState } from "react"
import { StyleSheet, Text, TextInput, View } from "react-native"
import Svg, { Path } from "react-native-svg"

import { QueueRow, type RowKindFields } from "@/components/kirtan/add/QueueRows"
import { KPress } from "@/components/kirtan/KPress"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { kindLabel } from "@/lib/kirtan/kind"
import type { RemoteBrief } from "@/lib/kirtan/remote"
import { parseDay, type SetTrack } from "@/lib/kirtan/sets"
import { RECORDING_KINDS, type DanceId, type RecordingKind } from "@/lib/kirtan/types"

/**
 * One track of a playlist from an event: its place and the two arrows that move it, then the same row the bulk queue
 * uses (title, state, retry, "already in the library", language and dance), then "Date and type" for the few tracks
 * that differ from the playlist. Shows data only; every change goes out through the callbacks.
 */

const Arrow = ({ color, down }: { color: string; down?: boolean }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={{ transform: [{ rotate: down ? "180deg" : "0deg" }] }}>
    <Path d="M6 15l6-6 6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
)

export type SetTrackHandlers = {
  onTitle: (id: string, title: string) => void
  onRemove: (id: string) => void
  onRetry: (id: string) => void
  onMove: (id: string, step: -1 | 1) => void
  onDay: (id: string, text: string) => void
  onKind: (id: string, kind: RecordingKind | undefined) => void
  onRowLanguage: (id: string) => void
  onRowDance: (id: string, dance: DanceId) => void
  onSimilarYes: (id: string) => void
  onSimilarNo: (id: string) => void
  onPlaySimilar: (brief: RemoteBrief) => void
  onHear: (track: SetTrack) => void
}

export function SetTrackRow({ theme, track, position, total, fields, firstDay, locked, handlers }: { theme: SongsTheme; track: SetTrack; position: number; total: number; fields: RowKindFields; firstDay: string; locked: boolean; handlers: SetTrackHandlers }) {
  const t = useT()
  const [open, setOpen] = useState(Boolean(track.recordedOn || track.kind))
  const [dayText, setDayText] = useState(track.recordedOn ?? "")
  const movable = !locked && track.status !== "uploading"
  const dayBad = dayText.trim() !== "" && !parseDay(dayText)
  const title = track.title || track.fileName
  return (
    <View style={styles.wrap}>
      <View style={styles.side}>
        <KPress accessibilityRole="button" accessibilityLabel={t("set.t.up", { title })} accessibilityState={{ disabled: !movable || position === 1 }} disabled={!movable || position === 1} onPress={() => handlers.onMove(track.id, -1)} pressedScale={0.88} style={[styles.arrow, { opacity: movable && position > 1 ? 1 : 0.25 }]}>
          <Arrow color={theme.textHeading} />
        </KPress>
        <Text style={[styles.place, { color: theme.textBody }]} accessibilityLabel={t("set.t.place", { n: position })}>
          {position}
        </Text>
        <KPress accessibilityRole="button" accessibilityLabel={t("set.t.down", { title })} accessibilityState={{ disabled: !movable || position === total }} disabled={!movable || position === total} onPress={() => handlers.onMove(track.id, 1)} pressedScale={0.88} style={[styles.arrow, { opacity: movable && position < total ? 1 : 0.25 }]}>
          <Arrow color={theme.textHeading} down />
        </KPress>
      </View>
      <View style={styles.main}>
        <QueueRow
          theme={theme}
          item={track}
          position={position}
          kindFields={fields}
          onRowLanguage={handlers.onRowLanguage}
          onRowDance={handlers.onRowDance}
          onTitle={handlers.onTitle}
          onRemove={handlers.onRemove}
          onRetry={handlers.onRetry}
          onHear={(row) => handlers.onHear(row as SetTrack)}
          onSimilarYes={handlers.onSimilarYes}
          onSimilarNo={handlers.onSimilarNo}
          onPlaySimilar={handlers.onPlaySimilar}
        />
        {track.status === "waiting" ? (
          <>
            <KPress accessibilityRole="button" accessibilityLabel={open ? t("set.t.less") : t("set.t.more")} accessibilityState={{ expanded: open }} onPress={() => setOpen((was) => !was)} pressedScale={0.97} style={styles.more}>
              <Text style={[styles.moreText, { color: theme.accent }]}>{open ? t("set.t.less") : t("set.t.more")}</Text>
            </KPress>
            {open ? (
              <View style={[styles.extra, { backgroundColor: theme.inner, borderColor: theme.line }]}>
                <Text style={[styles.label, { color: theme.textHeading }]}>{t("set.t.day")}</Text>
                <View style={[styles.dayBox, { backgroundColor: theme.card, borderColor: dayBad ? amColors.danger : theme.line }]}>
                  <TextInput
                    value={dayText}
                    onChangeText={(text) => {
                      setDayText(text)
                      handlers.onDay(track.id, text)
                    }}
                    editable={!locked}
                    placeholder={firstDay || t("set.d.date")}
                    placeholderTextColor={theme.textMuted}
                    accessibilityLabel={t("set.t.day")}
                    keyboardType="numbers-and-punctuation"
                    maxLength={10}
                    style={[styles.dayInput, { color: theme.textHeading }]}
                  />
                </View>
                <Text style={[styles.hint, { color: dayBad ? theme.dangerText : theme.textBody }]}>{dayBad ? t("set.err.date") : t("set.t.dayHint")}</Text>
                <Text style={[styles.label, { color: theme.textHeading }]}>{t("set.t.kind")}</Text>
                <View style={styles.chips} accessibilityRole="radiogroup">
                  {RECORDING_KINDS.map((kind) => {
                    const on = fields.kind === kind
                    return (
                      <KPress key={kind} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={kindLabel(kind)} onActivate={() => !locked && handlers.onKind(track.id, kind)} pressedScale={0.96} style={[styles.chip, { backgroundColor: on ? theme.ink900 : theme.card, borderColor: on ? theme.ink900 : theme.line }]}>
                        <Text style={[styles.chipText, { color: on ? theme.onInk : theme.textHeading }]}>{kindLabel(kind)}</Text>
                      </KPress>
                    )
                  })}
                </View>
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  side: { width: 36, alignItems: "center", paddingTop: 6 },
  arrow: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  place: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 18, fontVariant: ["tabular-nums"] },
  main: { flex: 1, minWidth: 0, gap: 6 },
  more: { alignSelf: "flex-start", minHeight: 36, justifyContent: "center", paddingHorizontal: 4 },
  moreText: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18, textDecorationLine: "underline" },
  extra: { borderRadius: 20, borderWidth: 1, padding: 14, gap: 10 },
  label: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 19 },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  dayBox: { minHeight: 48, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 14, justifyContent: "center", width: 180 },
  dayInput: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, paddingVertical: 10, outlineStyle: "none" as never },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 70, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 17 },
})
