import { useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { AuthorAvatar, SectionTitle } from "@/components/authors/AuthorsUi"
import { AuthorRow } from "@/components/authors/AuthorRow"
import { KirtanRow } from "@/components/kirtan/KirtanParts"
import { KPress } from "@/components/kirtan/KPress"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { authorsApi } from "@/lib/authors/api"
import { authorHref } from "@/lib/authors/constants"
import { playAuthor } from "@/lib/authors/playback"
import type { AuthorCardData } from "@/lib/authors/types"
import { useT } from "@/lib/i18n"
import type { RemoteRecording } from "@/lib/kirtan/remote"
import { fromRemote } from "@/lib/kirtan/submissions"
import { href } from "@/utils/href"

/** Remembered answers of "who is the author of this recording", so a list of recordings asks once per recording. */
const lineCache = new Map<string, AuthorCardData | null>()

/**
 * "By <name>" under a recording: the published author page this recording is on. Shows nothing while loading, when the
 * recording has no page, or when the request fails (it is an extra line, never a reason to show an error).
 * Put it under the title on the recording page: `<AuthorLine theme={theme} recordingId={kirtan.serverId} />`.
 */
export function AuthorLine({ theme, recordingId }: { theme: SongsTheme; recordingId: string | null | undefined }) {
  const t = useT()
  const router = useRouter()
  const [card, setCard] = useState<AuthorCardData | null>(recordingId ? (lineCache.get(recordingId) ?? null) : null)

  useEffect(() => {
    if (!recordingId) return undefined
    if (lineCache.has(recordingId)) {
      setCard(lineCache.get(recordingId) ?? null)
      return undefined
    }
    let live = true
    authorsApi()
      .byRecording(recordingId)
      .then(
        (found) => {
          lineCache.set(recordingId, found)
          if (live) setCard(found)
        },
        () => undefined,
      )
    return () => {
      live = false
    }
  }, [recordingId])

  if (!card) return null
  return (
    <KPress
      accessibilityRole="link"
      accessibilityLabel={t("authors.line.a11y", { name: card.display_name })}
      onPress={() => router.push(href(authorHref(card.slug)))}
      pressedScale={0.98}
      style={styles.line}
    >
      <AuthorAvatar slug={card.slug} name={card.display_name} photoUrl={card.photo_url} size={28} />
      <Text style={[styles.text, { color: theme.textBody }]} numberOfLines={1}>
        {t("authors.line.by")} <Text style={[styles.name, { color: theme.textHeading }]}>{card.display_name}</Text>
      </Text>
    </KPress>
  )
}

/** "More from this author": a few other recordings of the page, played as that author's queue. */
export function MoreFromAuthor({ theme, slug, name, excludeId }: { theme: SongsTheme; slug: string; name: string; excludeId?: string | null }) {
  const t = useT()
  const [items, setItems] = useState<RemoteRecording[]>([])

  useEffect(() => {
    let live = true
    authorsApi()
      .recordings(slug, { exclude: excludeId ?? undefined, limit: 5 })
      .then(
        (page) => {
          if (live) setItems(page.items)
        },
        () => undefined,
      )
    return () => {
      live = false
    }
  }, [slug, excludeId])

  if (!items.length) return null
  return (
    <View style={styles.more}>
      <SectionTitle theme={theme}>{t("authors.more.title", { name })}</SectionTitle>
      <View style={styles.rows}>
        {items.map((r) => (
          <KirtanRow key={r.id} theme={theme} kirtan={fromRemote(r)} compact onOpen={() => playAuthor({ slug, name }, items, { startId: r.id })} />
        ))}
      </View>
    </View>
  )
}

export { AuthorRow }

const styles = StyleSheet.create({
  line: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  text: { flexShrink: 1, fontFamily: amFonts.regular, fontSize: 14, lineHeight: 20 },
  name: { fontFamily: amFonts.semi },
  more: { gap: 12, paddingTop: 8 },
  rows: { gap: 8, paddingHorizontal: 20 },
})
