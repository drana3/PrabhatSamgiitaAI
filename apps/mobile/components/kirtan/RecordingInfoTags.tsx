import { StyleSheet, Text, View } from "react-native"

import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { infoTags, isAiRecording } from "@/lib/kirtan/recordingInfo"
import type { Kirtan } from "@/lib/kirtan/types"

/**
 * How a recording was made and how it sounds, on its page: the type of recording, the tempo, solo or group, as small tags. A recording
 * made by AI is never only a tag: it also carries a plain sentence, so a listener is never left to guess (docs/kiirtan-recording-info.md).
 * Renders nothing for a recording that says none of it (an older one).
 */
export function RecordingInfoTags({ theme, kirtan }: { theme: SongsTheme; kirtan: Kirtan }) {
  const t = useT()
  const tags = infoTags(kirtan)
  if (!tags.length) return null
  return (
    <View style={s.root} testID="recording-info">
      <View style={s.tags}>
        {tags.map((tag) => (
          <View key={tag.id} testID={`recording-info-${tag.id}`} style={[s.tag, { backgroundColor: tag.ai ? theme.peach : theme.card, borderColor: theme.line }]}>
            <Text style={[s.tagText, { color: tag.ai ? theme.accent : theme.textHeading }]}>{tag.label}</Text>
          </View>
        ))}
      </View>
      {isAiRecording(kirtan) ? (
        <Text style={[s.note, { color: theme.textBody }]} testID="recording-info-ai-note">
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
