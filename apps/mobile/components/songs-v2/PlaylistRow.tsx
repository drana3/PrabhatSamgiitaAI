import { StyleSheet, Text, View } from "react-native"
import { Lock } from "lucide-react-native"

import { CoverTile, PlaylistCover } from "@/components/playlists/PlaylistCover"
import { ChevronRightGlyph } from "@/components/songs-v2/Glyphs"
import { DotsIcon } from "@/components/songs-v2/ListIcons"
import { Press } from "@/components/songs-v2/Press"
import { overStyle } from "@/components/songs-v2/primitives"
import { MAX_FONT_SCALE } from "@/constants/fontScale"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"

const COVER = 56

type Common = { theme: SongsTheme; title: string; eyebrow: string; onOpen: () => void }

/**
 * A playlist in "Your playlists": its photo, name and song count, and a "..." that opens the playlist menu
 * (Rename, Change photo, Delete). Same white 20 pt card as CardButton; the photo is the one kept for the playlist.
 */
export function PlaylistRow({ theme, id, title, eyebrow, onOpen, onMenu }: Common & { id: string; onMenu: () => void }) {
  const t = useT()
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]}>
      <Press
        accessibilityRole="button"
        accessibilityLabel={`${eyebrow}, ${title}`}
        onPress={onOpen}
        pressedScale={0.98}
        outerStyle={styles.mainOuter}
        style={styles.main}
      >
        <PlaylistCover id={id} size={COVER} />
        <View style={styles.text}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[overStyle, { color: theme.accent }]} numberOfLines={1}>
            {eyebrow}
          </Text>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.title, { color: theme.textHeading }]} numberOfLines={2}>
            {title}
          </Text>
        </View>
      </Press>
      <Press accessibilityRole="button" accessibilityLabel={t("pl.menu.a11y", { name: title })} onPress={onMenu} pressedScale={0.88} style={styles.menu}>
        <DotsIcon size={22} color={theme.textBody} />
      </Press>
    </View>
  )
}

/**
 * An automatic playlist (My uploads): a photo tile, the count, a small lock in place of the "..." because it cannot be
 * renamed, deleted or edited. A tap opens the list it is made of.
 */
export function SystemPlaylistRow({ theme, photo, title, eyebrow, onOpen }: Common & { photo: number }) {
  const t = useT()
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={t("pl.uploads.a11y")}
      onPress={onOpen}
      pressedScale={0.98}
      style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]}
    >
      <CoverTile photo={photo} size={COVER} />
      <View style={styles.text}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[overStyle, { color: theme.accent }]} numberOfLines={1}>
          {eyebrow}
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.title, { color: theme.textHeading }]} numberOfLines={2}>
          {title}
        </Text>
      </View>
      <View style={styles.lock} accessible={false}>
        <Lock size={16} color={theme.textBody} />
      </View>
      <ChevronRightGlyph color={theme.textBody} />
    </Press>
  )
}

const styles = StyleSheet.create({
  card: { minHeight: 80, borderRadius: 20, borderWidth: 1, paddingVertical: 12, paddingLeft: 12, paddingRight: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  mainOuter: { flex: 1, minWidth: 0 },
  main: { flexDirection: "row", alignItems: "center", gap: 12 },
  text: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontFamily: amFonts.semi, fontSize: 19, lineHeight: 22, letterSpacing: -0.19 },
  menu: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  lock: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
})
