import { StyleSheet, Text, View } from "react-native"

import { PressBox } from "@/components/learn-v2/PressBox"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AmTheme } from "@/constants/tokens/amColors"
import { useT } from "@/lib/i18n"

/**
 * The plain line over the word cards and the quiz: "Deck: 3 songs, 42 words" and a "Change" button
 * that opens the "What to study" screen. A second, smaller line says when some songs have no words yet.
 */
export function ScopeLine({
  theme,
  deck,
  note,
  onChange,
}: {
  theme: AmTheme
  deck: string
  note?: string | null
  onChange: () => void
}) {
  const t = useT()
  return (
    <View style={[styles.box, { backgroundColor: theme.card, borderColor: theme.line }]}>
      <View style={styles.texts}>
        <Text style={[styles.deck, { color: theme.textHeading }]} numberOfLines={2}>
          {deck}
        </Text>
        {note ? <Text style={[styles.note, { color: theme.textBody }]}>{note}</Text> : null}
      </View>
      <PressBox
        accessibilityRole="button"
        accessibilityLabel={t("learn.scope.change.a11y")}
        onPress={onChange}
        pressedScale={0.95}
        style={styles.button}
      >
        <Text style={[styles.buttonText, { color: theme.eyebrow }]}>{t("learn.scope.change")}</Text>
      </PressBox>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 16, paddingVertical: 4, paddingLeft: 14, paddingRight: 4 },
  texts: { flex: 1, minWidth: 0 },
  deck: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 19, fontVariant: ["tabular-nums"] },
  note: { fontFamily: amFonts.medium, fontSize: 12, lineHeight: 16 },
  button: { height: 44, paddingHorizontal: 12, justifyContent: "center" },
  buttonText: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 18 },
})
