import { StyleSheet, Text, TextInput, View } from "react-native"

import { VideoLinkPreview } from "@/components/video/VideoLinkPreview"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { videoLinkProblem } from "@/lib/recordingVideos/uploadLink"
import { videoFailureText } from "@/lib/recordingVideos/words"

/**
 * "Video link (optional)" on the Kiirtan upload form: one link to a video of this recording on YouTube, Vimeo or the
 * Internet Archive (docs/kiirtan-video.md). Checked while typing with the same rules as the recording page's "Add a video".
 * The link is sent when the upload is done; a link that cannot be added never undoes the recording.
 */
export function VideoLinkField({ theme, value, onChange, disabled }: { theme: SongsTheme; value: string; onChange: (next: string) => void; disabled?: boolean }) {
  const t = useT()
  const problem = videoLinkProblem(value)
  return (
    <View style={s.field} testID="upload-video-link">
      <Text style={[s.label, { color: theme.textHeading }]}>{t("recVideos.field.label")}</Text>
      <Text style={[s.hint, { color: theme.textBody }]}>{t("recVideos.field.hint")}</Text>
      <View style={[s.box, { backgroundColor: theme.card, borderColor: problem ? amColors.danger : theme.line }]}>
        <TextInput
          value={value}
          onChangeText={onChange}
          editable={!disabled}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder={t("recVideos.field.placeholder")}
          placeholderTextColor={theme.textMuted}
          accessibilityLabel={t("recVideos.field.label")}
          style={[s.input, { color: theme.textHeading }]}
        />
      </View>
      {!problem && value.trim() ? <VideoLinkPreview value={value} textColor={theme.textHeading} /> : null}
      {problem ? (
        <Text style={[s.hint, { color: theme.dangerText }]} accessibilityLiveRegion="polite">
          {videoFailureText(t, problem)}
        </Text>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  field: { gap: 8 },
  label: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  hint: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  box: { minHeight: 56, borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 16, justifyContent: "center" },
  input: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, paddingVertical: 12, outlineStyle: "none" as never },
})
