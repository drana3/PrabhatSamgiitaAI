import { memo, type ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Image } from "expo-image"

import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { ChevronRightGlyph, PlusGlyph } from "@/components/songs-v2/Glyphs"
import { DownloadIcon } from "@/components/songs-v2/ListIcons"
import { LIST_SIDE, SongCover } from "@/components/songs-v2/ListParts"
import { PillButton } from "@/components/songs-v2/Pill"
import { Press } from "@/components/songs-v2/Press"
import { overStyle } from "@/components/songs-v2/primitives"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { photoForSeed } from "@/lib/photos/catalog"
import { INVITE_BODY, INVITE_TITLE, type LibraryCover, type LibraryRow } from "@/lib/library/yourLibrary"

/** Cover size of a row and its corner. The same 8dp corner as the covers in the Save sheet and the lists. */
export const LIBRARY_COVER = 56
const COVER_RADIUS = 8
const GLYPH_ON_DEEP = amColors.white

/** One warm photo for the saved Kiirtans: the photo system picks it from a fixed seed, so it never changes. */
const KIIRTAN_PHOTO = photoForSeed("your-library:kiirtans", "calm", { size: "small" }).thumb

function SymbolTile({ bg, children }: { bg: string; children: ReactNode }) {
  return <View style={[styles.tile, styles.center, { backgroundColor: bg }]}>{children}</View>
}

/**
 * The picture of a row. Symbol tiles sit on a deep green with a white glyph (white only on deep fills);
 * in Dark they sit on the raised surface. Saved Kiirtans take a photo; a playlist takes a collage of its songs.
 */
export const LibraryCoverView = memo(function LibraryCoverView({ cover, theme }: { cover: LibraryCover; theme: SongsTheme }) {
  const tone = (light: string) => (theme.dark ? theme.inner : light)
  switch (cover.kind) {
    case "mine":
      return (
        <SymbolTile bg={tone(amColors.sage900)}>
          <PlayerIcon name="heart" size={24} color={GLYPH_ON_DEEP} filled />
        </SymbolTile>
      )
    case "kiirtans":
      return (
        <View style={[styles.tile, { backgroundColor: theme.inner }]} accessibilityIgnoresInvertColors>
          <Image source={KIIRTAN_PHOTO} contentFit="cover" accessibilityIgnoresInvertColors style={styles.photo} />
        </View>
      )
    case "downloads":
      return (
        <SymbolTile bg={tone(amColors.sage700)}>
          <DownloadIcon state="done" size={26} color={GLYPH_ON_DEEP} fill={GLYPH_ON_DEEP} onFill={theme.dark ? theme.inner : amColors.sage700} />
        </SymbolTile>
      )
    case "uploads":
      return (
        <SymbolTile bg={tone(amColors.sage800)}>
          <PlayerIcon name="mic" size={24} color={GLYPH_ON_DEEP} />
        </SymbolTile>
      )
    case "playlist":
      return <PlaylistCollage numbers={cover.numbers} theme={theme} />
  }
})

/** Up to four song pictures: none shows a note, one fills the tile, two or three repeat to fill the 2 x 2. */
function PlaylistCollage({ numbers, theme }: { numbers: readonly number[]; theme: SongsTheme }) {
  if (numbers.length === 0) {
    return (
      <SymbolTile bg={theme.inner}>
        <PlayerIcon name="music" size={24} color={theme.textBody} />
      </SymbolTile>
    )
  }
  if (numbers.length === 1) {
    return (
      <View style={styles.tile} accessibilityIgnoresInvertColors>
        <SongCover number={numbers[0]} size={LIBRARY_COVER} radius={0} tint={theme.inner} />
      </View>
    )
  }
  const half = LIBRARY_COVER / 2
  const four = [0, 1, 2, 3].map((i) => numbers[i % numbers.length])
  return (
    <View style={[styles.tile, styles.collage, { backgroundColor: theme.inner }]} accessibilityIgnoresInvertColors>
      {four.map((n, i) => (
        <SongCover key={i} number={n} size={half} radius={0} tint={theme.inner} />
      ))}
    </View>
  )
}

/** A row of the library: cover, title over one meta line, chevron. */
export const LibraryListRow = memo(function LibraryListRow({
  theme,
  row,
  onOpen,
}: {
  theme: SongsTheme
  row: LibraryRow
  onOpen: (row: LibraryRow) => void
}) {
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={`${row.title}, ${row.meta}`}
      onPress={() => onOpen(row)}
      pressedScale={0.98}
      style={styles.row}
    >
      <LibraryCoverView cover={row.cover} theme={theme} />
      <View style={styles.text}>
        <Text style={[styles.title, { color: theme.textHeading }]} numberOfLines={1}>
          {row.title}
        </Text>
        <Text style={[styles.meta, { color: theme.textBody }]} numberOfLines={1}>
          {row.meta}
        </Text>
      </View>
      <ChevronRightGlyph size={20} color={theme.textBody} />
    </Press>
  )
})

/** The row that starts a playlist: a dashed tile with a plus, then its name. */
export function NewPlaylistRow({ theme, onPress }: { theme: SongsTheme; onPress: () => void }) {
  return (
    <Press accessibilityRole="button" accessibilityLabel="New playlist" onPress={onPress} pressedScale={0.98} style={styles.row}>
      <View style={[styles.tile, styles.center, styles.dashed, { borderColor: theme.textBody }]}>
        <PlusGlyph size={24} color={theme.textHeading} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, { color: theme.textHeading }]} numberOfLines={1}>
          New playlist
        </Text>
        <Text style={[styles.meta, { color: theme.textBody }]} numberOfLines={1}>
          Make one and add songs to it
        </Text>
      </View>
    </Press>
  )
}

/** Guests: forest card, white text, the one orange button of the page. Local rows stay below it. */
export function SignInInvite({ theme, onSignIn }: { theme: SongsTheme; onSignIn: () => void }) {
  return (
    <View style={[styles.invite, { backgroundColor: theme.dark ? theme.inner : amColors.sage900 }]}>
      <Text style={[overStyle, { color: amColors.gold300 }]}>Not signed in</Text>
      <Text style={styles.inviteTitle} accessibilityRole="header">
        {INVITE_TITLE}
      </Text>
      <Text style={styles.inviteBody}>{INVITE_BODY}</Text>
      <PillButton theme={theme} label="Sign in" onPress={onSignIn} style={styles.inviteButton} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: LIST_SIDE, paddingVertical: 8 },
  tile: { width: LIBRARY_COVER, height: LIBRARY_COVER, borderRadius: COVER_RADIUS, overflow: "hidden" },
  center: { alignItems: "center", justifyContent: "center" },
  photo: { width: LIBRARY_COVER, height: LIBRARY_COVER },
  collage: { flexDirection: "row", flexWrap: "wrap" },
  dashed: { borderWidth: 1.5, borderStyle: "dashed" },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: amFonts.semi, fontSize: 17, lineHeight: 22 },
  meta: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19 },
  invite: { marginHorizontal: 16, marginBottom: 10, borderRadius: 24, padding: 20, gap: 8 },
  inviteTitle: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 26, letterSpacing: -0.3, color: amColors.white },
  inviteBody: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 21, color: "rgba(255, 255, 255, 0.82)" },
  inviteButton: { marginTop: 8 },
})
