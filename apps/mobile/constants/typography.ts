import { Platform, type TextStyle } from "react-native"

const sans = Platform.select({
  ios: "Inter_400Regular",
  android: "Inter_400Regular",
  default: "Inter_400Regular",
})

const sansMedium = "Inter_500Medium"
const sansSemi = "Inter_600SemiBold"
const sansBold = "Inter_700Bold"
const serif = "Lora_700Bold"

export const fontFamily = {
  sans,
  sansMedium,
  sansSemi,
  sansBold,
  serif,
} as const

export const typography = {
  display: {
    fontFamily: serif,
    fontSize: 32,
    lineHeight: 40,
  } satisfies TextStyle,
  h1: {
    fontFamily: serif,
    fontSize: 28,
    lineHeight: 36,
  } satisfies TextStyle,
  h2: {
    fontFamily: sansBold,
    fontSize: 22,
    lineHeight: 30,
  } satisfies TextStyle,
  h3: {
    fontFamily: sansSemi,
    fontSize: 18,
    lineHeight: 26,
  } satisfies TextStyle,
  body: {
    fontFamily: sans,
    fontSize: 16,
    lineHeight: 24,
  } satisfies TextStyle,
  bodySmall: {
    fontFamily: sans,
    fontSize: 14,
    lineHeight: 20,
  } satisfies TextStyle,
  caption: {
    fontFamily: sansMedium,
    fontSize: 12,
    lineHeight: 16,
  } satisfies TextStyle,
  label: {
    fontFamily: sansSemi,
    fontSize: 13,
    lineHeight: 18,
  } satisfies TextStyle,
} as const
