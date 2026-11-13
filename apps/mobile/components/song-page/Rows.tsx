import { StyleSheet, Text, View } from "react-native"
import Svg, { Path } from "react-native-svg"

import { SpIcon } from "@/components/song-v2/SpIcon"
import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { usePageT } from "@/lib/songPage/pageCopy"

import type { SongPageModel } from "./useSongPageModel"

/** Five bars of different heights: a sound. */
function WaveGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <Path d="M4 10v4M8 6.5v11M12 3.5v17M16 7.5v9M20 10v4" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  )
}

/**
 * "6 recordings · open in the player": every recording of the song in one line under the header. A tap opens the
 * player on the recording that is chosen now (the versions are there). Not drawn for a song without a recording.
 */
export function RecordingsRow({ t, model }: { t: SpTheme; model: SongPageModel }) {
  const tr = usePageT()
  const count = model.recordingRows.length
  if (!count) return null
  const label = tr("songRec.row", { count })
  return (
    <SpPress onPress={model.openKaraoke} accessibilityLabel={`${label}. ${tr("songRec.open")}`} style={styles.rec} pressedScale={0.99}>
      <WaveGlyph size={20} color={t.ink500} />
      <Text style={[styles.recText, { color: t.ink500 }]} numberOfLines={1}>
        <Text style={[styles.recCount, { color: t.ink900 }]}>{label}</Text>
        {` · ${tr("songRec.open")}`}
      </Text>
      <SpIcon name="chevRight" size={18} color={t.ink500} strokeWidth={2} />
    </SpPress>
  )
}

/**
 * One line of a card that opens a sheet ("Chords by members · 2", "Piano notes · 2 versions"): a title, what is behind it
 * in a few words, a chevron. The sheet holds the long content, so the page stays short.
 */
export function SheetRow({ t, title, detail, onPress, last, accessibilityLabel }: { t: SpTheme; title: string; detail?: string; onPress: () => void; last?: boolean; accessibilityLabel?: string }) {
  return (
    <SpPress
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? (detail ? `${title}. ${detail}` : title)}
      pressedScale={0.99}
      style={[styles.row, { borderBottomColor: t.sand400, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}
    >
      <Text style={[styles.rowTitle, { color: t.ink900 }]} numberOfLines={1}>
        {title}
      </Text>
      {detail ? (
        <Text style={[styles.rowDetail, { color: t.ink500 }]} numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
      <SpIcon name="chevRight" size={20} color={t.ink500} strokeWidth={2} />
    </SpPress>
  )
}

const styles = StyleSheet.create({
  rec: { marginHorizontal: 20, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 4 },
  recText: { flex: 1, fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  recCount: { fontFamily: amFonts.bold },
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20 },
  rowTitle: { flex: 1, fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  rowDetail: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20, flexShrink: 1 },
})
