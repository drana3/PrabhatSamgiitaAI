import { StyleSheet, Text, View } from "react-native"

import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import type { CreditRow } from "@/lib/songPage/nowPlaying"

import { over } from "./spType"
import { SpPress } from "./SpUi"

/** "About this song" card in the page's own look; tap opens the Player's AboutSheet (the full story). */
export function SpAboutCard({ t, preview, onOpen }: { t: SpTheme; preview: string; onOpen: () => void }) {
  return (
    <SpPress
      onPress={onOpen}
      accessibilityLabel={`About this song. ${preview}. Read more`}
      pressedScale={0.985}
      style={[styles.about, { backgroundColor: t.white, borderColor: t.sand300 }]}
    >
      <View style={styles.aboutText}>
        <Text style={over(t)}>About this song</Text>
        <Text style={[styles.preview, { color: t.ink800 }]} numberOfLines={3}>
          {preview}
        </Text>
      </View>
      <View style={styles.flip}>
        <PlayerIcon name="chevronDown" size={22} color={t.ink500} />
      </View>
    </SpPress>
  )
}

/** Words, music and performer as a quiet block. */
export function SpCredits({ t, rows }: { t: SpTheme; rows: CreditRow[] }) {
  return (
    <View style={styles.credits}>
      {rows.map((row) => (
        <View key={row.role} style={styles.creditRow}>
          <Text style={[styles.role, { color: t.ink500 }]}>{row.role}</Text>
          <Text style={[styles.who, { color: t.ink800 }]}>{row.name}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  about: { marginHorizontal: 10, borderRadius: 30, borderWidth: 1, paddingLeft: 20, paddingRight: 8, paddingVertical: 16, flexDirection: "row", alignItems: "center" },
  aboutText: { flex: 1, minWidth: 0, gap: 6 },
  preview: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22 },
  flip: { width: 44, height: 44, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-90deg" }] },
  credits: { paddingHorizontal: 20, gap: 12 },
  creditRow: { gap: 2 },
  role: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 0.52, textTransform: "uppercase" },
  who: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22 },
})
