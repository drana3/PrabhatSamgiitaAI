export const colors = {
  background: "#FAF7F2",
  surface: "#FFFFFF",
  surfaceSoft: "#FFF8F0",
  surfaceWarm: "#FFF2E2",

  primary: "#F58220",
  primaryDark: "#D96709",
  primaryLight: "#FFE3C2",

  secondary: "#8C6A4B",
  secondarySoft: "#EFE2D6",

  textPrimary: "#201A17",
  textSecondary: "#6E625C",
  textMuted: "#9B908A",

  border: "#EDE5DF",
  divider: "#F0E9E3",

  success: "#4F8A67",
  warning: "#D89B2B",
  error: "#C84C4C",

  lotusPink: "#E9B8B4",
  lotusPurple: "#9D7CB7",
  spiritualGold: "#D7A341",

  playerBackground: "#211E1B",
  playerSurface: "#302B27",
  playerText: "#FFFFFF",
  playerMuted: "#CFC2B8",

  overlay: "rgba(32, 26, 23, 0.45)",
  white: "#FFFFFF",
  black: "#000000",
} as const

export const darkColors = {
  background: "#151311",
  surface: "#211E1B",
  surfaceSoft: "#2A2521",
  primary: "#FF982F",
  primaryDark: "#E27712",
  primaryLight: "#4A2D15",
  textPrimary: "#FFF9F3",
  textSecondary: "#CFC2B8",
  textMuted: "#9E9289",
  border: "#3B342E",
  divider: "#332E29",
} as const

export type AppColors = typeof colors
