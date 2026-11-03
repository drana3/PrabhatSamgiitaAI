import { StyleSheet, Text, View } from "react-native"
import { ChevronRight, Play } from "lucide-react-native"

import { CardRow, rowStyles } from "@/components/saved-v2/ui"
import { PressScale } from "@/components/today/motion"
import type { AmTheme } from "@/constants/tokens/amColors"
import { amControl } from "@/constants/tokens/amSpacing"
import { amType } from "@/constants/tokens/amTypography"
import { playlistMeta } from "@/lib/mineView"

/** `9 songs · made by you` over the playlist name, with a play disc. */
export function PlaylistRow({
  theme,
  name,
  songCount,
  onOpen,
  onPlay,
}: {
  theme: AmTheme
  name: string
  songCount: number
  onOpen: () => void
  onPlay: () => void
}) {
  const empty = songCount === 0
  return (
    <PressScale accessibilityRole="button" accessibilityLabel={`Open playlist ${name}`} onPress={onOpen} pressedScale={0.985}>
      <CardRow theme={theme}>
        <View style={rowStyles.copy}>
          <Text style={[amType.label, { color: theme.eyebrow }]}>{playlistMeta(songCount)}</Text>
          <Text style={[rowStyles.title, { color: theme.textHeading }]} numberOfLines={2}>
            {name}
          </Text>
        </View>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={`Play ${name}`}
          accessibilityState={{ disabled: empty }}
          disabled={empty}
          onPress={onPlay}
          pressedScale={0.92}
          style={[styles.disc, { backgroundColor: theme.brand, opacity: empty ? 0.35 : 1 }]}
        >
          <Play size={20} color={theme.onBrand} fill={theme.onBrand} />
        </PressScale>
        <ChevronRight size={20} color={theme.textMuted} />
      </CardRow>
    </PressScale>
  )
}

const styles = StyleSheet.create({
  disc: {
    width: amControl.pillHeight,
    height: amControl.pillHeight,
    borderRadius: amControl.pillHeight / 2,
    alignItems: "center",
    justifyContent: "center",
  },
})
