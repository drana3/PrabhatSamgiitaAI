import { StyleSheet, Text, View } from "react-native"

import { FestivalSongRows } from "@/components/festivals/FestivalSongRows"
import { overStyle } from "@/components/today/TodayBlocks"
import { TodayPress } from "@/components/today/TodayPress"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AmProto } from "@/constants/tokens/amToday"
import { useLanguage, useT } from "@/lib/i18n"
import { festivalText } from "@/lib/i18n/festivalText"
import { previewSongs, type EveFestival } from "@/lib/festivalEve"

/** How many songs the panel on Today shows; the festival page has the whole list. */
export const EVE_PREVIEW_SONGS = 3

/**
 * Today's panel for a festival that is tomorrow or today: the state in the eyebrow, the festival's name,
 * "Prabhat Samgiita for this day" and the first songs (play and open), then the way to the festival's page
 * with the whole list. Shown only for a festival that has songs (lib/festivalEve.ts).
 */
export function FestivalEvePanel({ p, festival, onSeeAll }: { p: AmProto; festival: EveFestival; onSeeAll: () => void }) {
  const t = useT()
  const language = useLanguage()
  const total = festival.songs.all.length
  const shown = previewSongs(festival.songs, EVE_PREVIEW_SONGS)
  const name = festivalText(festival, language).title
  const state = festival.phase === "today" ? t("fest.today") : t("fest.tomorrow")
  return (
    <View style={[styles.panel, { backgroundColor: p.orange100 }]} accessibilityLabel={t("festSongs.panel.a11y", { state, title: name })}>
      <Text style={[overStyle, { color: p.orange700 }]} numberOfLines={1}>
        {`${state} · ${festival.dateLabel}`}
      </Text>
      <Text style={[styles.name, { color: p.ink800 }]} accessibilityRole="header">
        {name}
      </Text>
      <Text style={[styles.sub, { color: p.ink500 }]}>{t("festSongs.heading")}</Text>
      <FestivalSongRows p={p} songs={shown} />
      {total > shown.length ? (
        <TodayPress
          accessibilityRole="button"
          accessibilityLabel={t("festSongs.seeAll.a11y", { count: total, title: name })}
          onPress={onSeeAll}
          pressedScale={0.97}
          style={[styles.all, { backgroundColor: p.ink900 }]}
        >
          <Text style={[styles.allText, { color: p.onInk }]}>{t("festSongs.seeAll", { count: total })}</Text>
        </TodayPress>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: { borderRadius: 28, padding: 16, gap: 8 },
  name: { fontFamily: amFonts.display, fontSize: 26, lineHeight: 26, letterSpacing: -0.52, textTransform: "uppercase" },
  sub: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19, marginBottom: 4 },
  all: { alignSelf: "flex-start", minHeight: 44, paddingHorizontal: 20, borderRadius: 70, justifyContent: "center", marginTop: 4 },
  allText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
})
