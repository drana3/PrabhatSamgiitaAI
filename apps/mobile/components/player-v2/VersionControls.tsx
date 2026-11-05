import { StyleSheet, Text } from "react-native"
import { Frost } from "@/components/common/Frost"

import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { TouchButton } from "@/components/player-v2/TouchButton"
import { playerColors, playerSize } from "@/components/player-v2/playerTokens"
import { amColors } from "@/constants/tokens/amColors"
import { amRadius } from "@/constants/tokens/amSpacing"
import { amFonts } from "@/constants/tokens/amTypography"

/**
 * The one chip line under the title: `[mic] Voice · Performer A · 6 versions  v`. It opens the Versions
 * sheet, where the recording is picked and "this version / all versions" is set. With a single
 * version it shows the recording only, with no count and no chevron (the sheet still holds Download).
 * While "all" is on, the position `2/6` sits in gold in place of the count.
 */
export function VersionChip({
  text,
  position,
  pickable,
  instrument,
  onPress,
}: {
  text: string
  position: string | null
  pickable: boolean
  instrument: "voice" | "other"
  onPress: () => void
}) {
  return (
    <TouchButton
      accessibilityRole="button"
      accessibilityLabel={pickable ? `Version: ${text}${position ? `, ${position}` : ""}. Choose a version` : `Recording: ${text}. Details and download`}
      onAction={onPress}
      containerStyle={styles.hit}
      style={styles.chip}
    >
      <Frost intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <PlayerIcon name={instrument === "voice" ? "mic" : "music"} size={16} color={amColors.white} />
      <Text style={styles.text} numberOfLines={1}>
        {text}
      </Text>
      {position ? <Text style={styles.position}>{position}</Text> : null}
      {pickable ? <PlayerIcon name="chevronSmall" size={playerSize.chipIcon} color={amColors.white} /> : null}
    </TouchButton>
  )
}

const styles = StyleSheet.create({
  hit: { alignSelf: "flex-start", maxWidth: "100%" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: playerSize.chipHeight,
    paddingHorizontal: 12,
    borderRadius: amRadius.pill,
    backgroundColor: playerColors.chipFill,
    borderWidth: 1,
    borderColor: playerColors.chipEdge,
    overflow: "hidden",
  },
  text: { fontFamily: amFonts.bold, fontSize: 13, color: amColors.white, flexShrink: 1 },
  position: { fontFamily: amFonts.bold, fontSize: 13, color: playerColors.gold, fontVariant: ["tabular-nums"] },
})
