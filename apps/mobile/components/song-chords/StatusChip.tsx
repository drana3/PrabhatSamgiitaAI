import { StyleSheet, Text, View } from "react-native"
import Svg, { Circle, Path } from "react-native-svg"

import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import type { ProposalStatus } from "@/lib/songChords/types"

import { PILL } from "./parts"

/**
 * Where a chart stands, as a round chip: an icon and words, never colour alone. Waiting = a clock, Published = a check,
 * Not accepted = a cross. Colours come from the app's own tokens (peach, sage, danger text).
 */
export function StatusChip({ theme, status }: { theme: SongsTheme; status: ProposalStatus }) {
  const t = useT()
  const label = t(`chordOffer.status.${status}` as "chordOffer.status.pending")
  const tone =
    status === "published"
      ? { bg: theme.oliveBg, fg: theme.oliveText, border: theme.oliveBg }
      : status === "rejected"
        ? { bg: "transparent", fg: theme.dangerText, border: theme.dangerText }
        : { bg: theme.peach, fg: theme.accent, border: theme.peach }
  return (
    <View accessible accessibilityLabel={label} style={[s.chip, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
        {status === "pending" ? (
          <>
            <Circle cx={12} cy={12} r={9} stroke={tone.fg} strokeWidth={2.25} />
            <Path d="M12 7v5l3 2" stroke={tone.fg} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : status === "published" ? (
          <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={tone.fg} strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <Path d="M6 6l12 12M18 6L6 18" stroke={tone.fg} strokeWidth={2.75} strokeLinecap="round" />
        )}
      </Svg>
      <Text style={[s.text, { color: tone.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  chip: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, height: 28, paddingHorizontal: 12, borderRadius: PILL, borderWidth: 1.5 },
  text: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
})
