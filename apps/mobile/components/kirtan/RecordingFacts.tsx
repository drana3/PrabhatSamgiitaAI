import { StyleSheet, Text, View } from "react-native"

import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { recordingFacts } from "@/lib/kirtan/facts"
import type { Kirtan } from "@/lib/kirtan/types"

export function RecordingFacts({ theme, kirtan: k }: { theme: SongsTheme; kirtan: Kirtan }) {
  const t = useT()
  const facts = recordingFacts(k, t as (key: string, vars?: Record<string, string | number>) => string)
  return (
    <View style={styles.wrap} testID="recording-facts">
      <Text style={[styles.text, { color: theme.textBody }]}>{facts.join(" · ")}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 2 },
  text: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
})
