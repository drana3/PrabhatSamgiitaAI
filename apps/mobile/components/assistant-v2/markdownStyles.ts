import { StyleSheet } from "react-native"

import type { AmTheme } from "@/constants/tokens/amColors"
import { amRadius } from "@/constants/tokens/amSpacing"
import { amFonts } from "@/constants/tokens/amTypography"

/** react-native-markdown-display styles in the design code: Roboto, am tokens. */
export function assistantMarkdownStyles(theme: AmTheme) {
  return StyleSheet.create({
    body: { fontFamily: amFonts.regular, fontSize: 16, lineHeight: 23, color: theme.textHeading },
    paragraph: { marginTop: 0, marginBottom: 12 },
    heading1: { fontFamily: amFonts.bold, fontSize: 19, lineHeight: 24, color: theme.textHeading, marginBottom: 8 },
    heading2: { fontFamily: amFonts.bold, fontSize: 19, lineHeight: 24, color: theme.textHeading, marginBottom: 8 },
    heading3: {
      fontFamily: amFonts.semi,
      fontSize: 13,
      lineHeight: 16,
      letterSpacing: 1,
      textTransform: "uppercase",
      color: theme.eyebrow,
      marginBottom: 8,
    },
    strong: { fontFamily: amFonts.bold, fontWeight: "normal" },
    em: { fontFamily: amFonts.regular, fontStyle: "italic", color: theme.textBody },
    bullet_list: { marginBottom: 12 },
    ordered_list: { marginBottom: 12 },
    list_item: { flexDirection: "row", marginBottom: 6 },
    bullet_list_icon: { color: theme.brand, marginRight: 8, marginTop: 1 },
    ordered_list_icon: { color: theme.eyebrow, fontFamily: amFonts.bold, marginRight: 8 },
    blockquote: {
      backgroundColor: theme.inner,
      borderLeftWidth: 3,
      borderLeftColor: theme.brand,
      borderRadius: amRadius.sm,
      paddingHorizontal: 12,
      paddingVertical: 4,
      marginBottom: 12,
    },
    code_inline: { fontFamily: amFonts.medium, backgroundColor: theme.inner, color: theme.textHeading },
    link: { color: theme.eyebrow, textDecorationLine: "underline" },
    hr: { backgroundColor: theme.line, height: StyleSheet.hairlineWidth, marginVertical: 12 },
  })
}
