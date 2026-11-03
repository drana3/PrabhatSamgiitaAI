import { StyleSheet, Text, View } from "react-native"
import { BlurView } from "expo-blur"
import { Image } from "expo-image"
import { Headphones, Pause } from "lucide-react-native"

import { PressScale } from "@/components/today/motion"
import { brandAssets } from "@/constants/brand"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amControl, amRadius } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import type { MockSong } from "@/data/mock"

const PANEL_HEIGHT = 290
const OVERLAP = 80

type Props = {
  theme: AmTheme
  song: MockSong
  eyebrow: string
  isPlaying: boolean
  onListen: () => void
  onReadLyrics: () => void
}

/**
 * A 30px picture panel and a frosted glass card that overlaps its bottom 80px.
 * The picture is always the photograph of Shrii Shrii Anandamurti, uncovered:
 * only its lower edge sits under the card, so the title lies on the picture
 * without hiding the face.
 */
export function TodayHero({ theme, song, eyebrow, isPlaying, onListen, onReadLyrics }: Props) {
  return (
    <View>
      <View style={styles.panel}>
        <Image
          source={brandAssets.guruQuoteHero}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="top"
          accessibilityLabel="Shrii Shrii Anandamurti"
        />
      </View>

      <View style={[styles.glassWrap, { borderColor: theme.glassEdge }]}>
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.glassTint]} />
        <View style={styles.glassBody}>
          <Text style={[amType.label, { color: theme.eyebrow }]}>{eyebrow}</Text>
          <Text style={[styles.title, { color: theme.textHeading }]} numberOfLines={2}>
            {song.title}
          </Text>
          <Text style={[amType.body, { color: theme.textBody }]}>
            PS {song.number}
            {song.durationSeconds ? ` · ${Math.round(song.durationSeconds / 60)} min` : ""}
          </Text>
          <View style={styles.actions}>
            <PressScale
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? `Pause PS ${song.number}` : `Listen to PS ${song.number}`}
              onPress={onListen}
              pressedScale={0.96}
              style={[styles.pill, { backgroundColor: theme.brand }]}
            >
              {isPlaying ? (
                <Pause size={18} color={theme.onBrand} fill={theme.onBrand} />
              ) : (
                <Headphones size={18} color={theme.onBrand} />
              )}
              <Text style={[styles.pillText, { color: theme.onBrand }]}>{isPlaying ? "Pause" : "Listen"}</Text>
            </PressScale>
            <PressScale
              accessibilityRole="button"
              accessibilityLabel={`Read lyrics of PS ${song.number}`}
              onPress={onReadLyrics}
              pressedScale={0.96}
              style={[styles.pill, { backgroundColor: amColors.ink900 }]}
            >
              <Text style={[styles.pillText, { color: amColors.white }]}>Read lyrics</Text>
            </PressScale>
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    height: PANEL_HEIGHT,
    borderRadius: amRadius.panel,
    overflow: "hidden",
    backgroundColor: amColors.sage900,
  },
  glassWrap: {
    marginTop: -OVERLAP,
    marginHorizontal: 10,
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
  },
  glassTint: { backgroundColor: "rgba(255, 255, 255, 0.62)" },
  glassBody: { padding: 20, gap: 8 },
  title: { fontFamily: amFonts.display, fontSize: 30, lineHeight: 32, letterSpacing: -0.6, textTransform: "uppercase" },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  pill: {
    height: amControl.pillHeight,
    borderRadius: amRadius.pill,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pillText: { fontFamily: amFonts.semi, fontSize: 16 },
})
