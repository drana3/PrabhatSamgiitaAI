import { useCallback, useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { fixtureStory } from "@/lib/fixtures/story"
import { useT } from "@/lib/i18n"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { storyLoader } from "@/lib/songsV2/storyApi"
import type { StorySheetContent } from "@/lib/songsV2/storySheet"

import { SpSheet } from "./SpSheet"
import { DoneLink, ShTitle } from "./SpSheets"
import { bodyT, secH2 } from "./spType"
import { SpPill, SpPress } from "./SpUi"

/**
 * `STORY SHEET` of the prototype: sand sheet, `Story · N min read` with Done, the title in 28px caps, the
 * paragraphs at 17/1.55 and the brand pill "Open the song". Text comes from the stories API; when that cannot be
 * reached the sheet says so and offers a retry. The prototype's sample story (`lib/fixtures/story.ts`) is
 * shown only under MOCKUP_DATA, never as a stand-in for a story that failed to load.
 */
export function SpStorySheet({
  t,
  visible,
  slug,
  onClose,
  onOpenSong,
}: {
  t: SpTheme
  visible: boolean
  slug: string | null
  onClose: () => void
  onOpenSong: (href: string) => void
}) {
  const tr = useT()
  const [content, setContent] = useState<StorySheetContent | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!visible || !slug || MOCKUP_DATA) return
    let active = true
    setFailed(false)
    const cached = storyLoader.peek(slug)
    if (cached) {
      setContent(cached)
      return
    }
    setContent(null)
    void storyLoader.load(slug).then((loaded) => {
      if (!active) return
      if (loaded) setContent(loaded)
      else setFailed(true)
    })
    return () => {
      active = false
    }
  }, [visible, slug, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  // MOCKUP_DATA: always the prototype's sample story, never the API
  const shown = MOCKUP_DATA ? fixtureStory(slug) : content
  const failedToLoad = !MOCKUP_DATA && failed && !content

  return (
    <SpSheet t={t} visible={visible} onClose={onClose} label={tr("story.sheet.label")} testID="sp-story-sheet">
      <ShTitle
        t={t}
        label={shown?.eyebrow ?? tr("story.sheet.label")}
        right={<DoneLink t={t} onPress={onClose} />}
      />
      <View style={styles.body}>
        {shown ? (
          <>
            <Text accessibilityRole="header" style={secH2(t, 28)}>
              {shown.title}
            </Text>
            {shown.paragraphs.map((paragraph, index) => (
              <Text key={index} style={bodyT(t)}>
                {paragraph}
              </Text>
            ))}
            {shown.songHref ? (
              <SpPill
                t={t}
                label={tr("story.sheet.openSong")}
                onPress={() => onOpenSong(shown.songHref!)}
                style={styles.cta}
              />
            ) : null}
          </>
        ) : failedToLoad ? (
          <>
            <Text accessibilityRole="alert" style={bodyT(t)}>
              {tr("story.sheet.failed")}
            </Text>
            <SpPress onPress={retry} accessibilityLabel={tr("story.sheet.retryLabel")} style={styles.retry}>
              <Text style={{ fontFamily: amFonts.semi, fontSize: 14, color: t.orange700 }}>
                {tr("notice.retry")}
              </Text>
            </SpPress>
          </>
        ) : (
          <Text style={bodyT(t)}>{tr("story.sheet.loading")}</Text>
        )}
      </View>
    </SpSheet>
  )
}

const styles = StyleSheet.create({
  body: { gap: 12, paddingHorizontal: 20 },
  retry: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  cta: { alignSelf: "flex-start", marginTop: 4, marginBottom: 24 },
})
