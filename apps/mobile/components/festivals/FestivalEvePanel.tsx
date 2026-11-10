import { StyleSheet, Text, View } from "react-native"

import { FestivalSongRows } from "@/components/festivals/FestivalSongRows"
import { overStyle } from "@/components/today/TodayBlocks"
import { TodayPress } from "@/components/today/TodayPress"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AmProto } from "@/constants/tokens/amToday"
import { cardDateLabel, cardPreviewSongs, festivalCardTitle, type TodayFestivalCard } from "@/lib/festivals/todayCard"
import { useLanguage, useT } from "@/lib/i18n"

/** How many songs the card on Today shows when the festival has a page of its own; the page has the whole list. */
export const EVE_PREVIEW_SONGS = 3

/**
 * Today's festival card, the first block of the page: the state in the eyebrow ("In 2 days · 8 Nov", "Tomorrow · 8 Nov",
 * "Today · 8 Nov"), the festival's name, "Prabhat Samgiita for this day" and the first songs (play and open), then the way to
 * the festival's page with the whole list. Shown only for a festival that has songs (lib/festivals/todayCard.ts).
 */
export function FestivalEvePanel({ p, festival, now, onSeeAll }: { p: AmProto; festival: TodayFestivalCard; now: Date; onSeeAll: (pageId: string) => void }) {
  const t = useT()
  const language = useLanguage()
  const total = festival.songs.all.length
  const shown = cardPreviewSongs(festival, EVE_PREVIEW_SONGS)
  const name = festivalCardTitle(festival, language)
  const date = cardDateLabel(festival, now)
  const soon = t("fest.inDays", { count: festival.daysUntil })
  const state = festival.phase === "today" ? t("fest.today") : festival.phase === "tomorrow" ? t("fest.tomorrow") : soon.charAt(0).toLocaleUpperCase(language) + soon.slice(1)
  const eyebrow = `${state} · ${date}`
  const pageId = festival.pageId
  return (
    <View style={[styles.panel, { backgroundColor: p.orange100 }]} accessibilityLabel={t("festSongs.panel.a11y", { state, title: name })}>
      <Text style={[overStyle, { color: p.orange700 }]} numberOfLines={1}>
        {`${eyebrow}${festival.expected ? ` · ${t("fest.expected")}` : ""}`}
      </Text>
      <Text style={[styles.name, { color: p.ink800 }]} accessibilityRole="header">
        {name}
      </Text>
      <Text style={[styles.sub, { color: p.ink500 }]}>{t("festSongs.heading")}</Text>
      <FestivalSongRows p={p} songs={shown} />
      {pageId && total > shown.length ? (
        <TodayPress
          accessibilityRole="button"
          accessibilityLabel={t("festSongs.seeAll.a11y", { count: total, title: name })}
          onPress={() => onSeeAll(pageId)}
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
