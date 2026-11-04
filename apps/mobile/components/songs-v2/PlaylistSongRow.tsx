import { StyleSheet, Text, View } from "react-native"
import { X } from "lucide-react-native"

import { Press } from "@/components/songs-v2/Press"
import { overStyle } from "@/components/songs-v2/primitives"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"

/**
 * One song of a playlist, drawn like the prototype song card (`.card.song`: 76px, radius 20,
 * eyebrow over a 19px title) with a 44px remove button where the catalog row has its heart.
 */
export function PlaylistSongRow({
  theme,
  eyebrow,
  title,
  accessibilityLabel,
  removeLabel,
  onOpen,
  onRemove,
}: {
  theme: SongsTheme
  eyebrow: string
  title: string
  accessibilityLabel: string
  removeLabel: string
  onOpen: () => void
  onRemove: () => void
}) {
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]}>
      <Press
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onOpen}
        pressedScale={0.98}
        outerStyle={styles.mainOuter}
        style={styles.main}
      >
        <Text style={[overStyle, { color: theme.accent }]} numberOfLines={1}>
          {eyebrow}
        </Text>
        <Text style={[styles.title, { color: theme.textHeading }]} numberOfLines={1}>
          {title}
        </Text>
      </Press>
      <Press accessibilityRole="button" accessibilityLabel={removeLabel} onPress={onRemove} pressedScale={0.88} style={styles.remove}>
        <X size={20} strokeWidth={1.75} color={theme.textBody} />
      </Press>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    minHeight: 76,
    borderRadius: 20,
    borderWidth: 1,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 20,
    paddingRight: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mainOuter: { flex: 1, minWidth: 0 },
  main: { gap: 4 },
  title: { fontFamily: amFonts.semi, fontSize: 19, lineHeight: 22, letterSpacing: -0.19 },
  remove: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
})
