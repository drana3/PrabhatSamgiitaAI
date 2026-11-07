import { StyleSheet, Text, View } from "react-native"
import Svg, { Circle, Path } from "react-native-svg"

import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import type { RowKind } from "@/lib/songChords/rows"

import { PILL } from "./parts"

/**
 * Where a chart stands, as a small round chip: an icon and one word, never colour alone. Draft = a pencil (only on
 * this phone), Waiting = a clock, Published = a check, Not accepted = a cross. Colours come from the app's own tokens.
 */
export function StatusChip({ theme, status }: { theme: SongsTheme; status: RowKind }) {
  const t = useT()
  const label = t(`chordOffer.status.short.${status}` as "chordOffer.status.short.draft")
  const tone =
    status === "published"
      ? { bg: theme.oliveBg, fg: theme.oliveText, border: theme.oliveBg }
      : status === "rejected"
        ? { bg: "transparent", fg: theme.dangerText, border: theme.dangerText }
        : status === "draft"
          ? { bg: "transparent", fg: theme.textBody, border: theme.line }
          : { bg: theme.peach, fg: theme.accent, border: theme.peach }
  return (
    <View accessible accessibilityLabel={t(`chordOffer.status.long.${status}` as "chordOffer.status.long.draft")} style={[s.chip, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
        {status === "pending" ? (
          <>
            <Circle cx={12} cy={12} r={9} stroke={tone.fg} strokeWidth={2.5} />
            <Path d="M12 7v5l3 2" stroke={tone.fg} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : status === "published" ? (
          <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={tone.fg} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        ) : status === "draft" ? (
          <Path d="M4 20l1-4L16.5 4.5a2 2 0 013 3L8 19l-4 1z" stroke={tone.fg} strokeWidth={2.25} strokeLinejoin="round" />
        ) : (
          <Path d="M6 6l12 12M18 6L6 18" stroke={tone.fg} strokeWidth={3} strokeLinecap="round" />
        )}
      </Svg>
      <Text style={[s.text, { color: tone.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  chip: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, height: 24, paddingHorizontal: 8, borderRadius: PILL, borderWidth: 1.5 },
  text: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
})
