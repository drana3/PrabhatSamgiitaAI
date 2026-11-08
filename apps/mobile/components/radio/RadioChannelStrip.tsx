import { ScrollView, StyleSheet, Text, View } from "react-native"

import { TouchButton } from "@/components/player-v2/TouchButton"
import { playerColors } from "@/components/player-v2/playerTokens"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useRadioPools } from "@/hooks/useRadioPools"
import { formatNumber, useT } from "@/lib/i18n"
import { activeChannel, channelsFor, selectionForChannel, type ChannelId } from "@/lib/radio/channels"
import { categoryName } from "@/lib/radio/labels"
import { useRadioSelectionStore } from "@/stores/radioSelectionStore"

/**
 * The Radio's stations (design variant D): a row of pills, "All" first, then one per category that has something to play.
 * A tap plays only that category from the next track. Feedback starts on touch-down. When a mix of several categories is
 * chosen no pill is on, and the "Mix several categories" link under the title says so.
 */
export function RadioChannelStrip() {
  const t = useT()
  const { counts, chosen } = useRadioPools()
  const setSelected = useRadioSelectionStore((s) => s.setSelected)
  const channels = channelsFor(counts)
  const active = activeChannel(chosen, counts)
  if (channels.length <= 1) return <View style={styles.empty} />
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
      style={styles.scroll}
    >
      {channels.map((id) => (
        <ChannelPill
          key={id}
          id={id}
          on={active === id}
          name={id === "all" ? t("radio.channel.all") : categoryName(id)}
          label={id === "all" ? t("radio.channel.all.a11y") : t("radio.channel.a11y", { name: categoryName(id), count: formatNumber(counts[id]) })}
          onPress={() => setSelected(selectionForChannel(id, counts))}
        />
      ))}
    </ScrollView>
  )
}

function ChannelPill({ on, name, label, onPress }: { id: ChannelId; on: boolean; name: string; label: string; onPress: () => void }) {
  return (
    <TouchButton
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      onAction={onPress}
      pressedScale={0.94}
      style={[styles.pill, on ? styles.pillOn : styles.pillOff]}
    >
      <Text style={[styles.text, { color: on ? amColors.sage900 : playerColors.text }]} numberOfLines={1}>
        {name}
      </Text>
    </TouchButton>
  )
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  empty: { height: 8 },
  row: { gap: 8, paddingHorizontal: 20, paddingVertical: 4, alignItems: "center" },
  pill: { minHeight: 44, minWidth: 56, paddingHorizontal: 16, borderRadius: 9999, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  pillOn: { backgroundColor: playerColors.text, borderColor: playerColors.text },
  pillOff: { backgroundColor: playerColors.glassDark, borderColor: playerColors.glassEdge },
  text: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
})
