import Markdown from "react-native-markdown-display"

import { colors } from "@/constants/colors"
import { spacing } from "@/constants/spacing"
import { fontFamily, typography } from "@/constants/typography"

type AssistantMarkdownProps = {
  text: string
}

/** ChatGPT-style markdown for AI companion replies on mobile. */
export function AssistantMarkdown({ text }: AssistantMarkdownProps) {
  return (
    <Markdown
      style={{
        body: {
          ...typography.bodySmall,
          color: colors.textPrimary,
          fontFamily: fontFamily.sans,
        },
        paragraph: {
          marginTop: 0,
          marginBottom: spacing.sm,
        },
        strong: {
          color: colors.textPrimary,
          fontFamily: fontFamily.sansSemi,
          fontWeight: "600",
        },
        em: {
          fontStyle: "italic",
        },
        bullet_list: {
          marginBottom: spacing.sm,
        },
        ordered_list: {
          marginBottom: spacing.sm,
        },
        list_item: {
          marginBottom: 4,
        },
        heading1: {
          color: colors.textPrimary,
          fontFamily: fontFamily.sansSemi,
          fontSize: 17,
          fontWeight: "600",
          marginBottom: spacing.xs,
        },
        heading2: {
          color: colors.textPrimary,
          fontFamily: fontFamily.sansSemi,
          fontSize: 16,
          fontWeight: "600",
          marginBottom: spacing.xs,
        },
        heading3: {
          color: colors.textPrimary,
          fontFamily: fontFamily.sansSemi,
          fontSize: 15,
          fontWeight: "600",
          marginBottom: spacing.xs,
        },
        blockquote: {
          backgroundColor: colors.surfaceSoft,
          borderLeftColor: colors.spiritualGold,
          borderLeftWidth: 3,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          marginBottom: spacing.sm,
        },
        code_inline: {
          backgroundColor: colors.secondarySoft,
          color: colors.textPrimary,
          fontSize: 13,
          paddingHorizontal: 4,
          paddingVertical: 1,
          borderRadius: 4,
        },
        fence: {
          backgroundColor: colors.secondarySoft,
          color: colors.textPrimary,
          fontSize: 13,
          padding: spacing.sm,
          borderRadius: 8,
          marginBottom: spacing.sm,
        },
        hr: {
          backgroundColor: colors.divider,
          height: 1,
          marginVertical: spacing.sm,
        },
        link: {
          color: colors.primaryDark,
        },
      }}
    >
      {text}
    </Markdown>
  )
}
