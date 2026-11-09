import { Image, StyleSheet, Text, View } from "react-native"
import Svg, { Circle, Path } from "react-native-svg"

import { KPress } from "@/components/kirtan/KPress"
import { LiveMark } from "@/components/broadcasts/LiveMark"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useLanguage, useT } from "@/lib/i18n"
import { liveDay, phaseNow, safeThumbnail } from "@/lib/broadcasts/rules"
import type { Broadcast } from "@/lib/broadcasts/types"
import { whenLine } from "@/lib/broadcasts/when"

/** A broadcast with nothing to show: a camera-less "on air" glyph (a dot and two arcs). */
export const AirGlyph = ({ color, size = 32 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <Circle cx={16} cy={16} r={3} fill={color} />
    <Path d="M10.5 10.5a7.8 7.8 0 0 0 0 11M21.5 10.5a7.8 7.8 0 0 1 0 11M6 6a14 14 0 0 0 0 20M26 6a14 14 0 0 1 0 20" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
)

/**
 * One broadcast as a card: the picture (YouTube's own thumbnail when the server found one, else a glyph), the phase
 * mark, the title and the line of time. `width` makes it a shelf card; without it it fills a column.
 */
export function BroadcastCard({ item, theme, onPress, width }: { item: Broadcast; theme: SongsTheme; onPress: () => void; width?: number }) {
  const t = useT()
  const language = useLanguage()
  const phase = phaseNow(item)
  const line = whenLine(item, t as never, language)
  const thumbnail = safeThumbnail(item.thumbnailUrl)
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
        {thumbnail ? <Image source={{ uri: thumbnail }} style={s.image} accessibilityIgnoresInvertColors /> : <AirGlyph color={theme.accent} />}
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
  card: { borderRadius: 20, borderWidth: 1.5, overflow: "hidden" },
  picture: { height: 120, alignItems: "center", justifyContent: "center" },
  image: { width: "100%", height: "100%" },
  text: { padding: 16, gap: 8 },
  title: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22 },
  when: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
})
