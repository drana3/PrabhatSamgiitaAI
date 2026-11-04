import { StyleSheet, Text, View } from "react-native"

import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { SheetPill } from "@/components/player-v2/Rows"
import { Sheet } from "@/components/player-v2/Sheet"
import { TouchButton } from "@/components/player-v2/TouchButton"
import { playerColors } from "@/components/player-v2/playerTokens"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AboutContent } from "@/lib/playerV2/playerActions"

/** Height of the peek card; the Player keeps this much room for it above the tab pill. */
export const ABOUT_CARD_HEIGHT = 56

/**
 * "About this song" peek at the foot of the Player (like "About the artist" in Spotify): a glass card
 * with the first lines of the story. Tap it and the full text rises as a sheet.
 */
export function AboutCard({ preview, onOpen }: { preview: string; onOpen: () => void }) {
  return (
    <TouchButton
      accessibilityRole="button"
      accessibilityLabel={`About this song. ${preview}. Read more`}
      onAction={onOpen}
      pressedScale={0.98}
      containerStyle={styles.hit}
      style={styles.card}
    >
      <View style={styles.text}>
        <Text style={styles.over}>About this song</Text>
        <Text style={styles.preview} numberOfLines={1}>
          {preview}
        </Text>
      </View>
      <View style={styles.chevron}>
        <View style={styles.flip}>
          <PlayerIcon name="chevronDown" size={22} color={playerColors.textSoft} />
        </View>
      </View>
    </TouchButton>
  )
}

type SheetProps = {
  visible: boolean
  theme: AmTheme
  songTitle: string
  about: AboutContent | null
  onOpenSong: () => void
  onClose: () => void
}

/** The story of the song in full, with a button to its page (words, chords, story). */
export function AboutSheet({ visible, theme, songTitle, about, onOpenSong, onClose }: SheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title="About this song" theme={theme}>
      <Text style={[styles.songTitle, { color: theme.textHeading }]} accessibilityRole="header">
        {songTitle}
      </Text>
      {about?.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text style={[styles.sectionHead, { color: theme.eyebrow }]}>{section.heading}</Text>
          <Text style={[styles.body, { color: theme.textBody }]}>{section.text}</Text>
        </View>
      ))}
      <View style={styles.cta}>
        <SheetPill theme={theme} tone="brand" label="Open song page" onPress={onOpenSong} />
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  hit: { marginHorizontal: 20 },
  card: {
    height: ABOUT_CARD_HEIGHT,
    borderRadius: 20,
    paddingLeft: 16,
    paddingRight: 6,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: playerColors.panelFill,
    borderWidth: 1,
    borderColor: playerColors.panelEdge,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  over: { fontFamily: amFonts.bold, fontSize: 11, lineHeight: 14, letterSpacing: 0.88, textTransform: "uppercase", color: amColors.gold300 },
  preview: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19, color: playerColors.text },
  chevron: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  flip: { transform: [{ rotate: "180deg" }] },
  songTitle: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 24, letterSpacing: -0.48, textTransform: "uppercase", paddingHorizontal: 20, paddingBottom: 12 },
  section: { paddingHorizontal: 20, paddingBottom: 16, gap: 6 },
  sectionHead: { fontFamily: amFonts.bold, fontSize: 12, letterSpacing: 0.96, textTransform: "uppercase" },
  body: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 24 },
  cta: { paddingHorizontal: 20, paddingTop: 4 },
})
