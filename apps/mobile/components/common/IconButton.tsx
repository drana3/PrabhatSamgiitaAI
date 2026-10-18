import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native"

import { colors } from "@/constants/colors"
import { radius } from "@/constants/spacing"

type Props = {
  onPress: () => void
  accessibilityLabel: string
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  soft?: boolean
}

export function IconButton({ onPress, accessibilityLabel, children, style, soft }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        soft && styles.soft,
        pressed && styles.pressed,
        style,
      ]}
    >
      {children}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  soft: {
    backgroundColor: colors.surfaceSoft,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
})
