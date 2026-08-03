import { Platform, type ViewStyle } from "react-native"

export function softShadow(level: 1 | 2 = 1): ViewStyle {
  if (Platform.OS === "android") {
    return { elevation: level === 1 ? 2 : 3 }
  }

  return {
    shadowColor: "#000",
    shadowOpacity: level === 1 ? 0.07 : 0.1,
    shadowRadius: level === 1 ? 12 : 16,
    shadowOffset: { width: 0, height: level === 1 ? 4 : 6 },
  }
}
