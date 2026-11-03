import { StyleSheet, Text, View } from "react-native"

import { Card, Pill, SectionHeading } from "@/components/song-v2/common"
import type { AmTheme } from "@/constants/tokens/amColors"
import { amSpace } from "@/constants/tokens/amSpacing"
import { amFonts, amFontSize, amType } from "@/constants/tokens/amTypography"
import type { SongExplanation } from "@/lib/songPage/songContent"

/**
 * Explain (SCR-16 item 7): a summary, three key points, key terms and the
 * button into the Ask feature. Texts are written offline and reviewed; the
 * section is hidden until a reviewed record exists. The word AI appears only
 * in the disclosure line.
 */
export function ExplainSection({
  theme,
  explanation,
  onAsk,
}: {
  theme: AmTheme
  explanation: SongExplanation
  onAsk: () => void
}) {
  return (
    <View style={styles.section}>
      <SectionHeading theme={theme}>Explain</SectionHeading>
      <Card theme={theme} style={styles.card}>
        <Text style={[amType.body, { color: theme.textHeading }]}>{explanation.summary}</Text>
        {explanation.keyPoints.slice(0, 3).map((point, i) => (
          <View key={i} style={styles.point}>
            <Text style={[styles.index, { color: theme.eyebrow }]}>{i + 1}</Text>
            <Text style={[amType.body, styles.pointText, { color: theme.textHeading }]}>{point}</Text>
          </View>
        ))}
        {explanation.keyTerms.length ? <Text style={[amType.label, { color: theme.eyebrow }]}>Key terms</Text> : null}
        {explanation.keyTerms.map((term) => (
          <Text key={term.term} style={[amType.body, { color: theme.textBody }]}>
            <Text style={{ fontFamily: amFonts.bold, color: theme.textHeading }}>{term.term}</Text>
            {` · ${term.meaning}`}
          </Text>
        ))}
      </Card>
      <Pill theme={theme} tone="brand" label="Ask about this song" onPress={onAsk} />
      <Text style={[amType.body, { color: theme.textMuted }]}>
        Written by AI from the song text and the discourse notes. It can be wrong.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: amSpace.s3 },
  card: { gap: amSpace.s3 },
  point: { flexDirection: "row", gap: amSpace.s3 },
  index: { fontFamily: amFonts.display, fontSize: amFontSize.lead },
  pointText: { flex: 1 },
})
