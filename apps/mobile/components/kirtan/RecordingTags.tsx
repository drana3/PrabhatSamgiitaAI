import { StyleSheet, Text, View } from "react-native"

import { TagRail } from "@/components/kirtan/TagRail"

import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { pageTags } from "@/lib/kirtan/pageTags"
import { isAiRecording } from "@/lib/kirtan/recordingInfo"
import type { Kirtan } from "@/lib/kirtan/types"

/**
 * The tag row of a recording's page: style, how it was recorded, tempo, solo or group, instrument and the Avarta mark

 * (lib/kirtan/pageTags.ts), on ONE line with "+N" and a compact sheet for the rest (components/kirtan/TagRail.tsx, Dada 9 Nov 2026).
 * A recording made by AI also carries a plain sentence, never only a tag. Nothing for a recording
 * that says none of it.
 */
export function RecordingTags({ theme, kirtan }: { theme: SongsTheme; kirtan: Kirtan }) {
  const t = useT()
  const tags = pageTags(kirtan)
  if (!tags.length) return null
  return (
    <View style={s.root} testID="recording-tags">
      <TagRail
        title={t("recTag.sheet")}
        testID="recording-tags-rail"
        chips={tags.map((tag) => ({ key: tag.id, label: tag.label, tone: tag.tone === "plain" ? "plain" : "accent", testID: `recording-tag-${tag.id}` }))}
      />
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
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
})
