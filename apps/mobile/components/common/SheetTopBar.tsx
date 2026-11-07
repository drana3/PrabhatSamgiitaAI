import { StyleSheet, View } from "react-native"
import Svg, { Path } from "react-native-svg"

import { KPress } from "@/components/kirtan/KPress"
import { amColors } from "@/constants/tokens/amColors"
import { useSheetTop } from "@/hooks/useScreenTop"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { SHEET_CLOSE_SIZE, sheetBarHeight } from "@/lib/screenTop"

/**
 * The top row of a screen in modal presentation: a grabber in the middle and the close button on the right, both
 * below the status bar and the Dynamic Island, in a row of their own so no text ever sits beside the button.
 * Put it above the ScrollView. The row's height is `sheetBarHeight(useSheetTop())` (lib/screenTop.ts).
 */
export function SheetTopBar({ onClose, closeLabel }: { onClose: () => void; closeLabel: string }) {
  const theme = useSongsTheme()
  const top = useSheetTop()
  return (
    <View style={[styles.bar, { paddingTop: top, height: sheetBarHeight(top) }]}>
      <View style={[styles.handle, { backgroundColor: theme.dark ? "rgba(255,255,255,0.22)" : amColors.sand400 }]} />
      <KPress
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
        onPress={onClose}
        pressedScale={0.9}
        outerStyle={[styles.close, { top }]}
        style={[styles.disc, { backgroundColor: theme.card, borderColor: theme.line }]}
      >
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path d="M6 6l12 12M18 6L6 18" stroke={theme.textHeading} strokeWidth={1.75} strokeLinecap="round" />
        </Svg>
      </KPress>
    </View>
  )
}

const styles = StyleSheet.create({
  // the row's height is explicit (top + button + gap), so the page below it starts clear of the button
  bar: { alignItems: "center" },
  handle: { width: 40, height: 5, borderRadius: 3, marginTop: 4 },
  close: { position: "absolute", right: 16 },
  disc: { width: SHEET_CLOSE_SIZE, height: SHEET_CLOSE_SIZE, borderRadius: SHEET_CLOSE_SIZE / 2, borderWidth: 1, alignItems: "center", justifyContent: "center" },
})
