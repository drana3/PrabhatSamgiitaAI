import { StyleSheet, Text, View } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"

import { KIIRTAN_TYPE_TONES } from "@/components/kirtan/KiirtanCover"
import { KPress } from "@/components/kirtan/KPress"
import { amFonts } from "@/constants/tokens/amTypography"
import { artistInitials, artistToneIndex, type Artist } from "@/lib/kirtan/artists"
import { photoForSeed } from "@/lib/photos/catalog"

const TONE_ORDER = ["bnk", "lila", "festival", "other"] as const

export function artistGradient(id: string): readonly [string, string] {
  return KIIRTAN_TYPE_TONES[TONE_ORDER[artistToneIndex(id)]]
}

/** A round photo of an artist; the gradient with initials shows while there is no photo. */
export function ArtistAvatar({ artist, size }: { artist: Pick<Artist, "id" | "name" | "photoUrl">; size: number }) {
  const [from, to] = artistGradient(artist.id)
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden" }}>
      <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {artist.photoUrl ? null : (
        <>
          <Image source={photoForSeed(artist.id, "calm").thumb} contentFit="cover" accessibilityIgnoresInvertColors style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(10,14,8,0.5)" }]} />
        </>
      )}
      <View style={styles.center}>
        <Text style={[styles.initials, { fontSize: Math.round(size * 0.34), lineHeight: Math.round(size * 0.4) }]}>{artistInitials(artist.name)}</Text>
      </View>
      {artist.photoUrl ? <Image source={{ uri: artist.photoUrl }} contentFit="cover" accessibilityIgnoresInvertColors style={StyleSheet.absoluteFill} /> : null}
    </View>
  )
}

/** One artist of the shelf: 62px avatar with the name under it. */
export function ArtistChip({ artist, color, onPress }: { artist: Artist; color: string; onPress: (id: string) => void }) {
  return (
    <KPress accessibilityRole="button" accessibilityLabel={`Artist ${artist.name}`} onPress={() => onPress(artist.id)} pressedScale={0.94} style={styles.chip}>
      <ArtistAvatar artist={artist} size={62} />
      <Text style={[styles.name, { color }]} numberOfLines={2}>
        {artist.name}
      </Text>
    </KPress>
  )
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  initials: { fontFamily: amFonts.display, color: "rgba(255,255,255,0.92)", letterSpacing: 0.5 },
  chip: { width: 78, alignItems: "center", gap: 8 },
  name: { fontFamily: amFonts.semi, fontSize: 12.5, lineHeight: 16, textAlign: "center" },
})
