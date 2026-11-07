import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { FestivalSongRows } from "@/components/festivals/FestivalSongRows"
import { overStyle } from "@/components/today/TodayBlocks"
import { TodayPress } from "@/components/today/TodayPress"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AmProto } from "@/constants/tokens/amToday"
import { songsForFestival, type FestivalSongLink } from "@/data/festivalSongs"
import { formatDate, useT } from "@/lib/i18n"

/** Songs shown in a group before "Show more". */
export const GROUP_FIRST = 5

function Group({
  p,
  title,
  note,
  songs,
}: {
  p: AmProto
  title: string
  note: string
  songs: readonly FestivalSongLink[]
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const rest = songs.length - GROUP_FIRST
  const shown = open || rest <= 0 ? songs : songs.slice(0, GROUP_FIRST)
  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, styles.inset, { color: p.ink800 }]} accessibilityRole="header">
        {title}
      </Text>
      <Text style={[styles.note, styles.inset, { color: p.ink500 }]}>{note}</Text>
      <FestivalSongRows p={p} songs={shown} />
      {rest > 0 ? (
        <TodayPress
          accessibilityRole="button"
          accessibilityLabel={open ? t("festSongs.detail.less") : t("festSongs.detail.more", { count: rest })}
          onPress={() => setOpen((value) => !value)}
          pressedScale={0.97}
          style={[styles.more, { borderColor: p.sand400 }]}
        >
          <Text style={[styles.moreText, { color: p.ink800 }]}>{open ? t("festSongs.detail.less") : t("festSongs.detail.more", { count: rest })}</Text>
        </TodayPress>
      ) : null}
    </View>
  )
}

/**
 * The festival page's "Prabhat Samgiita for this day": the festival's own list, then the songs composed on
 * its calendar day, each group named for what it is (data/festivalSongs.ts). Renders nothing when the
 * festival has neither, so a festival without songs shows no empty box.
 */
export function FestivalSongSections({ p, festival }: { p: AmProto; festival: { id: string; month: number; day: number; year: number } }) {
  const t = useT()
  const songs = songsForFestival(festival)
  if (songs.all.length === 0) return null
  const date = formatDate(new Date(festival.year, festival.month - 1, festival.day), "dayMonthLong")
  return (
    <View style={styles.root}>
      <Text style={[overStyle, styles.inset, { color: p.orange700 }]}>{t("festSongs.heading")}</Text>
      {songs.listed.length > 0 ? (
        <Group p={p} title={t("festSongs.detail.listed")} note={t("festSongs.detail.listed.note")} songs={songs.listed} />
      ) : null}
      {songs.composed.length > 0 ? (
        <Group p={p} title={t("festSongs.detail.composed", { date })} note={t("festSongs.detail.composed.note")} songs={songs.composed} />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: 20, paddingTop: 12 },
  /** the same inset as the date, the name and the line under it on the festival page */
  inset: { paddingHorizontal: 10 },
  group: { gap: 8 },
  groupTitle: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 24, letterSpacing: -0.48, textTransform: "uppercase" },
  note: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19, marginBottom: 4 },
  more: { alignSelf: "flex-start", minHeight: 44, paddingHorizontal: 20, borderRadius: 70, borderWidth: 1, justifyContent: "center", marginTop: 4 },
  moreText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
})
