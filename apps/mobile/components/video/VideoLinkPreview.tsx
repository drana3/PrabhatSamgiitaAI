import { useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { VideoThumb } from "@/components/video/VideoThumb"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { videosBackend } from "@/lib/recordingVideos/backend"
import { parseVideoUrl } from "@/lib/recordingVideos/rules"
import type { VideoPreview } from "@/lib/recordingVideos/types"
import { useAuthStore } from "@/stores/authStore"

/** The wait after the last keystroke before the server is asked (the field is not a search box: one look per pasted link). */
export const PREVIEW_DEBOUNCE_MS = 500

/**
 * What a typed link looks like once it is added (docs/kiirtan-video.md, "Previews"): the same 16:9 picture box as everywhere, with the
 * picture the phone can build from the video's id at once, and the title and the picture the server found a moment later
 * (signed-in members only; a failed look changes nothing: the box stays as it is). Nothing is shown for a link that does not
 * parse, and nothing is downloaded: the picture comes from the site's image host through the same loader as every other preview.
 */
export function VideoLinkPreview({ value, textColor = amColors.ink900 }: { value: string; textColor?: string }) {
  const mode = useAuthStore((s) => s.mode)
  const parsed = value.trim() ? parseVideoUrl(value) : null
  const url = parsed?.ok ? parsed.url : null
  const [found, setFound] = useState<VideoPreview | null>(null)
  useEffect(() => {
    setFound(null)
    if (!url || (mode !== "signed_in" && !MOCKUP_DATA)) return
    let alive = true
    const timer = setTimeout(() => {
      videosBackend()
        .preview(url)
        .then((answer) => {
          if (alive && answer.url === url) setFound(answer)
        })
        .catch(() => undefined) // no look, no change: the box already shows what the phone can build
    }, PREVIEW_DEBOUNCE_MS)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [url, mode])
  if (!parsed?.ok) return null
  const title = found?.title ?? null
  return (
    <View style={styles.wrap} testID="video-link-preview">
      <VideoThumb video={{ provider: parsed.provider, url: parsed.url, thumbnailUrl: found?.thumbnailUrl ?? null }} title={title} radius={12} testID="video-link-preview-thumb" />
      {title ? (
        <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>
          {title}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 6, paddingTop: 4 },
  title: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 20 },
})
