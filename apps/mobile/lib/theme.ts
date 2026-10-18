import { Platform, type ViewStyle } from "react-native"

export const layout = {
  gutter: 16,
  maxContentWidth: 720,
} as const

export function cardElevation(level: 1 | 2 = 1): ViewStyle {
  if (Platform.OS === "android") {
    return { elevation: level === 1 ? 2 : 4 }
  }
  return {
    shadowColor: "#092d56",
    shadowOpacity: 0.07 * level,
    shadowRadius: 10 * level,
    shadowOffset: { width: 0, height: 3 * level },
  }
}

export const hairline = "rgba(9, 45, 86, 0.08)" as const
