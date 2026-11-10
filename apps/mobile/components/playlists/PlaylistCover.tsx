import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { Image } from "expo-image"

import { amRadius } from "@/constants/tokens/amSpacing"
import { STOCK_PHOTOS, type StockPhoto } from "@/lib/photos/catalog"
import { defaultCoverFor } from "@/lib/playlists/playlistCover"
import { usePlaylistCover } from "@/stores/playlistCoverStore"

let byNumber: Map<number, StockPhoto> | null = null

/** The stock photo with this shortlist number (docs/photo-system.md); any photo of the library if the number is unknown. */
export function coverPhoto(n: number): StockPhoto {
  if (!byNumber) byNumber = new Map(STOCK_PHOTOS.map((p) => [p.n, p]))
  return byNumber.get(n) ?? (byNumber.get(defaultCoverFor("fallback")) as StockPhoto)
}

/** Square photo tile. `thumb` (480 px) up to 240 dp, the larger `cover` file above. */
export function CoverTile({ photo, size, radius = amRadius.sm, style }: { photo: number; size: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const p = coverPhoto(photo)
  return (
    <View style={[{ width: size, height: size, borderRadius: radius, overflow: "hidden" }, style]}>
      <Image
        source={size <= 240 ? p.thumb : p.cover}
        contentFit="cover"
        transition={0}
        accessibilityIgnoresInvertColors
        accessible={false}
        style={StyleSheet.absoluteFill}
      />
    </View>
  )
}

/** The photo of a playlist: the one kept for its id, or the one derived from its id until a choice is stored. */
export function PlaylistCover({ id, size, radius, style }: { id: string; size: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const photo = usePlaylistCover(id)
  return <CoverTile photo={photo} size={size} radius={radius} style={style} />
}
