import { StyleSheet, Text, View } from "react-native"

import { amFonts } from "@/constants/tokens/amTypography"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useT } from "@/lib/i18n"
import { MODERATION_KEYS, type ModerationKind } from "@/lib/moderationNotice"

/**
 * The warning at the very end of an upload form, just above the send button: everything sent is looked at by the
 * moderators, and one of very poor quality may be declined or removed. It says "reviewed ... may be declined or
 * removed" and nothing about waiting for approval, because a recording goes live at once and the team looks afterwards
 * (docs/kiirtan-publishing.md); a member's chord chart does wait for the team (docs/chord-proposals.md). The words are
 * true for both. It is a block of the form's own stack: the form's gap keeps it off the button, it adds no margin.
 */
export function ModerationNotice({ kind = "recording" }: { kind?: ModerationKind }) {
  const t = useT()
  const theme = useSongsTheme()
  return (
    <View style={[styles.box, { backgroundColor: theme.peach, borderColor: theme.accent }]} accessibilityRole="summary">
      <Text style={[styles.title, { color: theme.textHeading }]}>{t(MODERATION_KEYS.title)}</Text>
      <Text style={[styles.body, { color: theme.textBody }]}>{t(MODERATION_KEYS[kind])}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { borderLeftWidth: 4, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, gap: 4 },
  title: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
})
