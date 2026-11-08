import { StyleSheet, Text, View } from "react-native"

import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { pageTags } from "@/lib/kirtan/pageTags"
import { isAiRecording } from "@/lib/kirtan/recordingInfo"
import type { Kirtan } from "@/lib/kirtan/types"

/**
 * The tag row of a recording's page: style, how it was recorded, tempo, solo or group, instrument and the Avarta mark
 * (lib/kirtan/pageTags.ts). A recording made by AI also carries a plain sentence, never only a tag. Nothing for a recording
 * that says none of it.
 */
export function RecordingTags({ theme, kirtan }: { theme: SongsTheme; kirtan: Kirtan }) {
  const t = useT()
  const tags = pageTags(kirtan)
  if (!tags.length) return null
  return (
    <View style={s.root} testID="recording-tags">
      <View style={s.tags}>
        {tags.map((tag) => (
          <View key={tag.id} testID={`recording-tag-${tag.id}`} style={[s.tag, { backgroundColor: tag.tone === "plain" ? theme.card : theme.peach, borderColor: theme.line }]}>
            <Text style={[s.tagText, { color: tag.tone === "plain" ? theme.textHeading : theme.accent }]}>{tag.label}</Text>
          </View>
        ))}
      </View>
      {isAiRecording(kirtan) ? (
        <Text style={[s.note, { color: theme.textBody }]} testID="recording-tags-ai-note">
          {t("recinfo.type.aiBanner")}
        </Text>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  root: { gap: 8 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { minHeight: 28, paddingHorizontal: 12, borderRadius: 70, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  tagText: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
})
