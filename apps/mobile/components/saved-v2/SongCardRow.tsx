import type { ReactNode } from "react"
import { Text, View } from "react-native"

import { CardRow, rowStyles } from "@/components/saved-v2/ui"
import { PressScale } from "@/components/today/motion"
import type { AmTheme } from "@/constants/tokens/amColors"
import { amType } from "@/constants/tokens/amTypography"

/**
 * Song row of Mine (spec SCR-11 item 5): white card, eyebrow `PS 3 · Offline`,
 * title that wraps instead of truncating, a trailing action, no thumbnail.
 */
export function SongCardRow({
  theme,
  eyebrow,
  title,
  onOpen,
  trailing,
  accessibilityLabel,
}: {
  theme: AmTheme
  eyebrow: string
  title: string
  onOpen: () => void
  trailing?: ReactNode
  accessibilityLabel: string
}) {
  return (
    <PressScale accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onOpen} pressedScale={0.985}>
      <CardRow theme={theme}>
        <View style={rowStyles.copy}>
          <Text style={[amType.label, { color: theme.eyebrow }]}>{eyebrow}</Text>
          <Text style={[rowStyles.title, { color: theme.textHeading }]} numberOfLines={2}>
            {title}
          </Text>
        </View>
        {trailing}
      </CardRow>
    </PressScale>
  )
}
