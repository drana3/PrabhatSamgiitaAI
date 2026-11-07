import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated"

import { SaveMark } from "@/components/save/SaveMark"
import { amSpring } from "@/constants/tokens/amMotion"
import { useSaveState } from "@/hooks/useSaveState"
import { saveButtonLabel, type SaveButtonSize, type SaveItem } from "@/lib/save/saveToSheet"
import { openSaveSheet } from "@/stores/saveSheetStore"
import { useT } from "@/lib/i18n"

type Props = {
  item: SaveItem
  size?: SaveButtonSize
  /** Colour of the empty circle and its plus, for the ground it sits on. */
  color?: string
  /** Spoken after the label: the song or Kiirtan name. */
  title?: string
  /** Size of the touch area; at least 44. */
  hit?: number
  style?: StyleProp<ViewStyle>
}

/**
 * The save control of the whole app: a circle-plus that turns into a filled circle-check once the
 * song or Kiirtan is in Mine or in any playlist. Both states open the same "Save to" sheet (like
 * Spotify), so a saved item can be changed or removed from there. Press feedback starts on
 * touch-down; the sheet opens on release so a scroll that starts on the button does not open it.
 */
export function SaveButton({ item, size = 24, color, title, hit = 44, style }: Props) {
  useT() // re-render when the language changes: the label is built by saveButtonLabel
  const { saved } = useSaveState(item)
  const scale = useSharedValue(1)
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={saveButtonLabel(saved)}
      accessibilityHint={title}
      accessibilityState={{ selected: saved }}
      onPressIn={() => {
        scale.value = withSpring(0.86, amSpring.default)
      }}
      onPressOut={() => {
        scale.value = withSpring(1, amSpring.default)
      }}
      onPress={() => openSaveSheet(item)}
      style={[styles.hit, { width: hit, height: hit, borderRadius: hit / 2 }, style]}
    >
      <Animated.View style={animated}>
        <SaveMark on={saved} size={size} color={color} />
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  hit: { alignItems: "center", justifyContent: "center" },
})
