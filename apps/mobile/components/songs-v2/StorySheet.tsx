import { useCallback, useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { BottomSheet } from "@/components/songs-v2/BottomSheet"
import { BrandPill } from "@/components/songs-v2/primitives"
import { Press } from "@/components/songs-v2/Press"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { storyLoader } from "@/lib/songsV2/storyApi"
import { buildStorySheet, type StorySheetContent } from "@/lib/songsV2/storySheet"

type Preview = { slug: string; title: string; teaser?: string; songNumbers?: number[] }

/**
 * Story sheet (spec SCR-19). White sheet: eyebrow `Story · N min read`, title
 * in Roboto 800 caps, three to six short paragraphs, then an orange
 * "Open the song" button. A preview (title, teaser) from the list shows at
 * once; the full text replaces it when the API answers.
 */
export function StorySheet({
  open,
  theme,
  slug,
  preview,
  onClose,
  onOpenSong,
}: {
  open: boolean
  theme: SongsTheme
  slug: string | null
  preview?: Preview | null
  onClose: () => void
  /** Opens the song page; the parent decides how the sheet leaves. */
  onOpenSong: (href: string) => void
}) {
  const [content, setContent] = useState<StorySheetContent | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!open || !slug) return
    let active = true
    setFailed(false)
    const cached = storyLoader.peek(slug)
    if (cached) {
      setContent(cached)
      return
    }
    setContent(preview && preview.slug === slug ? buildStorySheet(preview) : null)
    void storyLoader.load(slug).then((loaded) => {
      if (!active) return
      if (loaded) setContent(loaded)
      else setFailed(true)
    })
    return () => {
      active = false
    }
    // preview is only the first paint; the load drives the rest
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slug, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  const hasBody = Boolean(content?.paragraphs.length)

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      theme={theme}
      eyebrow={content?.eyebrow ?? "Story"}
      accessibilityLabel="Story"
    >
      {content ? <Text style={[styles.title, { color: theme.textHeading }]}>{content.title}</Text> : null}
      {content?.paragraphs.map((paragraph, index) => (
        <Text key={index} style={[styles.body, { color: theme.textHeading }]}>
          {paragraph}
        </Text>
      ))}
      {!content && !failed ? <Text style={[styles.body, { color: theme.textBody }]}>Loading the story…</Text> : null}
      {failed && !hasBody ? (
        <Press accessibilityRole="button" accessibilityLabel="Try again" onPress={retry} style={styles.retry}>
          <Text style={[styles.body, { color: theme.textBody }]}>Could not load this story. Tap to try again.</Text>
        </Press>
      ) : null}
      {content?.songHref ? (
        <View style={styles.cta}>
          <BrandPill theme={theme} label="Open the song" onPress={() => onOpenSong(content.songHref!)} />
        </View>
      ) : null}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  title: { fontFamily: amFonts.display, fontSize: 28, lineHeight: 28, letterSpacing: -0.56, textTransform: "uppercase" },
  body: { fontFamily: amFonts.regular, fontSize: 17, lineHeight: 26 },
  cta: { alignItems: "flex-start", marginTop: 4, marginBottom: 24 },
  retry: { paddingVertical: 12 },
})
