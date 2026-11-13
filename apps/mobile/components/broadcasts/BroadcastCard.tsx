import { StyleSheet, Text, View } from "react-native"
import Svg, { Circle, Path } from "react-native-svg"

import { KPress } from "@/components/kirtan/KPress"
import { LiveMark } from "@/components/broadcasts/LiveMark"
import { PhotoSurface } from "@/components/photos/PhotoSurface"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useLanguage, useT } from "@/lib/i18n"
import { liveDay, phaseNow } from "@/lib/broadcasts/rules"
import type { Broadcast } from "@/lib/broadcasts/types"
import { whenLine } from "@/lib/broadcasts/when"
import { photoForSeed } from "@/lib/photos/catalog"
import { broadcastPhotoMood, broadcastPhotoSeed } from "@/lib/photos/defaultPhoto"

/** A broadcast with nothing to show: a camera-less "on air" glyph (a dot and two arcs). */
export const AirGlyph = ({ color, size = 32 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <Circle cx={16} cy={16} r={3} fill={color} />
    <Path d="M10.5 10.5a7.8 7.8 0 0 0 0 11M21.5 10.5a7.8 7.8 0 0 1 0 11M6 6a14 14 0 0 0 0 20M26 6a14 14 0 0 1 0 20" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
)

/** Every card of the shelf and the list has this size: the same picture, the same three text rows, whatever the broadcast says. */
export const BROADCAST_CARD = { picture: 120, height: 288 } as const

/**
 * One broadcast as a card: a photo of the app's own library (never a frame of the stream: our broadcasts are audio only, so no video and no
 * YouTube picture is ever shown; the system picks the photo by the broadcast's id, lib/photos/defaultPhoto.ts), the phase mark, the title
 * and the line of time. "On the air" and "Coming up" are one size (Dada, 13 Nov 2026): a fixed height, the title always has two rows and
 * the time line two rows of room, so a short title does not make a short card. `width` makes it a shelf card; without it it fills a column.
 */
export function BroadcastCard({ item, theme, onPress, width }: { item: Broadcast; theme: SongsTheme; onPress: () => void; width?: number }) {
  const t = useT()
  const language = useLanguage()
  const phase = phaseNow(item)
  const line = whenLine(item, t as never, language)
  const photo = photoForSeed(broadcastPhotoSeed(item.id), broadcastPhotoMood(item.title), { size: "small" })
  return (
    <KPress
      accessibilityRole="button"
      accessibilityLabel={t("bc.l.row.a11y", { title: item.title, status: line })}
      onPress={onPress}
      pressedScale={0.97}
      outerStyle={width ? { width } : s.fill}
      style={[s.card, { backgroundColor: theme.card, borderColor: theme.line }]}
    >
      <View style={[s.picture, { backgroundColor: theme.peach }]}>
        <PhotoSurface photo={photo} scrim={0.45} />
        <AirGlyph color="rgba(255,255,255,0.92)" />
      </View>
      <View style={s.text}>
        <LiveMark phase={phase} theme={theme} day={liveDay(item)} />
        <Text style={[s.title, { color: theme.textHeading }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[s.when, { color: theme.textBody }]} numberOfLines={2}>
          {line}
        </Text>
      </View>
    </KPress>
  )
}

const s = StyleSheet.create({
  fill: { alignSelf: "stretch" },
  card: { height: BROADCAST_CARD.height, borderRadius: 20, borderWidth: 1.5, overflow: "hidden" },
  picture: { height: BROADCAST_CARD.picture, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  text: { padding: 16, gap: 8 },
  title: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22, minHeight: 44 },
  when: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20, minHeight: 40 },
})
