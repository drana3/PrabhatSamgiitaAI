import { useEffect, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { AuthorAvatar } from "@/components/authors/AuthorsUi"
import { HOME_INSET, HomeSectionHead } from "@/components/home/HomeBlocks"
import { KPress } from "@/components/kirtan/KPress"
import type { AmProto } from "@/constants/tokens/amToday"
import { amFonts } from "@/constants/tokens/amTypography"
import { authorsApi } from "@/lib/authors/api"
import { AUTHORS_HREF, authorHref } from "@/lib/authors/constants"
import type { AuthorCardData, DirectoryKind } from "@/lib/authors/types"
import { useT } from "@/lib/i18n"
import { href } from "@/utils/href"

const SHELF_SIZE = 12

/**
 * The "Authors" shelf of the Kiirtan tab: the pages people listen to most, round photos in a row, and "See all" into the
 * catalog (/authors). Hidden while loading, on an error, and when there are no pages yet (the tab must not show an
 * empty shelf). `kind` narrows it to the tab's chip (Kiirtan, Bhajan...); "all" shows everyone.
 * One line for a screen: `<AuthorsShelf p={p} kind={kind === "all" ? undefined : kind} />`.
 */
export function AuthorsShelf({ p, kind }: { p: AmProto; kind?: DirectoryKind }) {
  const t = useT()
  const router = useRouter()
  const [items, setItems] = useState<AuthorCardData[]>([])

  useEffect(() => {
    let live = true
    authorsApi()
      .directory({ sort: "listeners", kind, limit: SHELF_SIZE })
      .then(
        (page) => live && setItems(page.items),
        () => live && setItems([]),
      )
    return () => {
      live = false
    }
  }, [kind])

  if (!items.length) return null
  return (
    <View style={styles.wrap}>
      <HomeSectionHead
        p={p}
        eyebrow={t("authors.shelf.eyebrow")}
        first={t("authors.shelf.first")}
        second={t("authors.shelf.second")}
        action={{ label: t("authors.shelf.all"), onPress: () => router.push(href(kind ? `${AUTHORS_HREF}?kind=${kind}` : AUTHORS_HREF)) }}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((a) => (
          <KPress key={a.slug} accessibilityRole="button" accessibilityLabel={t("authors.row.a11y", { name: a.display_name })} onPress={() => router.push(href(authorHref(a.slug)))} pressedScale={0.94} style={styles.chip}>
            <AuthorAvatar slug={a.slug} name={a.display_name} photoUrl={a.photo_url} size={62} />
            <Text style={[styles.name, { color: p.ink800 }]} numberOfLines={2}>
              {a.display_name}
            </Text>
          </KPress>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  row: { paddingHorizontal: HOME_INSET, gap: 8 },
  chip: { width: 78, alignItems: "center", gap: 8 },
  name: { fontFamily: amFonts.semi, fontSize: 12.5, lineHeight: 16, textAlign: "center" },
})
