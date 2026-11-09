import { StyleSheet, Text, View } from "react-native"

import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { KIIRTAN_TABS, type KiirtanTab } from "@/lib/recordingExtras/kiirtanTabs"

/**
 * The four tabs of a Kiirtan's page: Chords, Video, Notes, Story (lib/recordingExtras/kiirtanTabs.ts holds the order).
 * One row of four equal pills, the chosen one filled; each answers on touch-down. No sliding indicator: the content
 * under the tabs changes, the tabs stay where they are.
 */
export function KiirtanTabs({ t, value, onChange }: { t: SpTheme; value: KiirtanTab; onChange: (next: KiirtanTab) => void }) {
  const tr = useT()
  return (
    <View style={styles.row} accessibilityRole="tablist" accessibilityLabel={tr("kPage.tabs")} testID="kiirtan-tabs">
      {KIIRTAN_TABS.map((id) => {
        const on = id === value
        return (
          <SpPress
            key={id}
            onPress={() => onChange(id)}
            accessibilityRole="tab"
            accessibilityLabel={tr(`kPage.tab.${id}`)}
            accessibilityState={{ selected: on }}
            pressedScale={0.97}
            testID={`kiirtan-tab-${id}`}
            style={[styles.tab, { backgroundColor: on ? t.action : "transparent", borderColor: on ? t.action : t.ink800 }]}
          >
            <Text style={[styles.text, { color: on ? t.onAction : t.ink900 }]} numberOfLines={1}>
              {tr(`kPage.tab.${id}`)}
            </Text>
          </SpPress>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  tab: { flex: 1, minWidth: 0, minHeight: 48, borderRadius: 9999, borderWidth: 1.5, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  text: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
})
