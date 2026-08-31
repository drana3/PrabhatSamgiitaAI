import { setStringAsync } from "expo-clipboard"
import { Alert } from "react-native"

export async function copyTextToClipboard(text: string, label = "Copied") {
  const trimmed = text.trim()
  if (!trimmed) return false
  await setStringAsync(trimmed)
  Alert.alert(label, "Copied to clipboard.")
  return true
}
