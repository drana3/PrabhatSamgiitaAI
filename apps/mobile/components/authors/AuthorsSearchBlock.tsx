import { useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { AuthorRow } from "@/components/authors/AuthorRow"
import { SIDE } from "@/components/authors/AuthorsUi"
import { KPress } from "@/components/kirtan/KPress"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { authorsApi } from "@/lib/authors/api"
import { AUTHORS_HREF, authorHref } from "@/lib/authors/constants"
import type { AuthorCardData } from "@/lib/authors/types"
import { useT } from "@/lib/i18n"
import { href } from "@/utils/href"

/** How many authors the search shows before "See all". */
const SHOWN = 3
/** Wait after the last keystroke before the directory is asked. */
const DELAY_MS = 300

/**
 * The "Authors" block of the unified search: up to three pages that match the typed words, and "See all" into the directory.
 * Renders nothing for an empty query, no match, or an error (search must not show an error because authors failed).
 * One line for the search screen: `<AuthorsSearchBlock theme={theme} query={query} />`.
 */
export function AuthorsSearchBlock({ theme, query }: { theme: SongsTheme; query: string }) {
  const t = useT()
  const router = useRouter()
  const [found, setFound] = useState<{ query: string; items: AuthorCardData[]; total: number } | null>(null)
  const q = query.trim()

  useEffect(() => {
    if (q.length < 2) {
      setFound(null)
      return undefined
    }
    let live = true
    const timer = setTimeout(() => {
      authorsApi()
        .directory({ q, sort: "listeners", limit: SHOWN })
        .then(
          (page) => {
            if (live) setFound({ query: q, items: page.items, total: page.total })
          },
          () => {
            if (live) setFound(null)
          },
        )
    }, DELAY_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [q])

  if (!found || found.query !== q || !found.items.length) return null
  return (
    <View style={styles.block}>
      <Text style={[styles.title, { color: theme.textHeading }]} accessibilityRole="header">
        {t("authors.search.title")}
      </Text>
      <View style={styles.rows}>
        {found.items.map((a) => (
          <AuthorRow key={a.slug} theme={theme} author={a} inset={false} onOpen={(slug) => router.push(href(authorHref(slug)))} />
        ))}
      </View>
      {found.total > found.items.length ? (
        <KPress accessibilityRole="button" accessibilityLabel={t("authors.search.all")} onPress={() => router.push(href(`${AUTHORS_HREF}?q=${encodeURIComponent(q)}`))} pressedScale={0.97} style={styles.all}>
          <Text style={[styles.allText, { color: theme.accentText }]}>{t("authors.search.all")}</Text>
        </KPress>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  block: { gap: 10, paddingHorizontal: SIDE, paddingVertical: 8 },
  title: { fontFamily: amFonts.display, fontSize: 22, lineHeight: 26, letterSpacing: -0.4, textTransform: "uppercase" },
  rows: { gap: 8 },
  all: { minHeight: 44, justifyContent: "center" },
  allText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
})
