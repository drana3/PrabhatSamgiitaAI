import { useEffect, useRef, useState } from "react"
import { FlatList, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { Stack, useLocalSearchParams, useRouter } from "expo-router"

import { AccountBar, topInset } from "@/components/account/AccountUi"
import { AuthorRow } from "@/components/authors/AuthorRow"
import { Chip, DemoNote, LoadingRows, PillButton, SIDE, StateBlock } from "@/components/authors/AuthorsUi"
import { amFonts } from "@/constants/tokens/amTypography"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { authorsApi } from "@/lib/authors/api"
import { BECOME_AUTHOR_HREF, DIRECTORY_PAGE, MY_AUTHOR_HREF, PROFILE_LANGUAGES, authorHref } from "@/lib/authors/constants"
import { say } from "@/lib/authors/text"
import { DIRECTORY_KINDS, type AuthorCardData, type DirectoryKind, type DirectorySort } from "@/lib/authors/types"
import { useT } from "@/lib/i18n"
import { kindLabel } from "@/lib/kirtan/kind"
import { errorKeyOf, useAuthorStore } from "@/stores/authorStore"
import { href } from "@/utils/href"
import { useSafeAreaInsets } from "react-native-safe-area-context"

const SORTS: DirectorySort[] = ["listeners", "new", "name"]
const DELAY_MS = 300

/** All authors: search, sort by listeners / new / name, a way into "Become an author", and every empty/error state. */
export default function AuthorsScreen() {
  const t = useT()
  const theme = useSongsTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const bottom = useScrollBottomInset()
  const params = useLocalSearchParams<{ q?: string; kind?: string; language?: string }>()
  const api = authorsApi()
  const mine = useAuthorStore((s) => s.mine)
  const mineLoad = useAuthorStore((s) => s.load)
  const refreshMine = useAuthorStore((s) => s.refresh)
  const [typed, setTyped] = useState(String(params.q ?? ""))
  const [query, setQuery] = useState(typed.trim())
  const [sort, setSort] = useState<DirectorySort>("listeners")
  const [kind, setKind] = useState<DirectoryKind | undefined>(DIRECTORY_KINDS.find((k) => k === params.kind))
  const [language, setLanguage] = useState<string | undefined>(PROFILE_LANGUAGES.find((l) => l === params.language))
  const [items, setItems] = useState<AuthorCardData[]>([])
  const [total, setTotal] = useState(0)
  const [state, setState] = useState<"loading" | "ready" | "error" | "more">("loading")
  const [errorKey, setErrorKey] = useState<string>("authors.error.generic")
  const ticket = useRef(0)

  // Opened straight from a link or the shelf, the store may not know yet whether this person already has a page.
  useEffect(() => {
    if (mineLoad === "idle") void refreshMine()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setQuery(typed.trim()), DELAY_MS)
    return () => clearTimeout(timer)
  }, [typed])

  const load = (offset: number) => {
    const mineTicket = ++ticket.current
    setState(offset ? "more" : "loading")
    api.directory({ q: query, sort, kind, language, offset, limit: DIRECTORY_PAGE }).then(
      (page) => {
        if (mineTicket !== ticket.current) return
        setItems((old) => (offset ? [...old, ...page.items] : page.items))
        setTotal(page.total)
        setState("ready")
      },
      (failure: unknown) => {
        if (mineTicket !== ticket.current) return
        setErrorKey(errorKeyOf(failure))
        setState("error")
      },
    )
  }
  useEffect(() => {
    load(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, sort, kind, language])

  const open = (slug: string) => router.push(href(authorHref(slug)))
  const back = () => (router.canGoBack() ? router.back() : router.replace(href("/v2/kiirtan")))

  const header = (
    <View style={styles.header}>
      {api.demo ? <DemoNote theme={theme} /> : null}
      <View style={styles.pad}>
        <TextInput
          accessibilityLabel={t("authors.dir.search")}
          placeholder={t("authors.dir.search")}
          placeholderTextColor={theme.textMuted}
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          style={[styles.search, { backgroundColor: theme.card, borderColor: theme.line, color: theme.textHeading }]}
        />
      </View>
      <View style={styles.sorts} accessibilityRole="tablist">
        {SORTS.map((s) => (
          <Chip key={s} theme={theme} label={t(`authors.dir.sort.${s}`)} active={sort === s} onPress={() => setSort(s)} />
        ))}
      </View>
      <Text style={[styles.filterLabel, { color: theme.textMuted }]}>{t("authors.dir.filter.kind")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityRole="tablist">
        <Chip theme={theme} label={t("authors.dir.filter.all")} active={!kind} onPress={() => setKind(undefined)} />
        {DIRECTORY_KINDS.map((k) => (
          <Chip key={k} theme={theme} label={kindLabel(k)} active={kind === k} onPress={() => setKind(kind === k ? undefined : k)} />
        ))}
      </ScrollView>
      <Text style={[styles.filterLabel, { color: theme.textMuted }]}>{t("authors.dir.filter.language")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityRole="tablist">
        <Chip theme={theme} label={t("authors.dir.filter.all")} active={!language} onPress={() => setLanguage(undefined)} />
        {PROFILE_LANGUAGES.filter((l) => l !== "other").map((l) => (
          <Chip key={l} theme={theme} label={say(t, `authors.language.${l}`)} active={language === l} onPress={() => setLanguage(language === l ? undefined : l)} />
        ))}
      </ScrollView>
      <View style={styles.pad}>
        <PillButton
          theme={theme}
          tone="line"
          label={mine ? t("authors.cta.mine") : t("authors.cta.become")}
          onPress={() => router.push(href(mine ? MY_AUTHOR_HREF : BECOME_AUTHOR_HREF))}
        />
      </View>
    </View>
  )

  let empty: React.ReactNode = null
  if (state === "loading") empty = <LoadingRows theme={theme} rows={5} />
  else if (state === "error") empty = <StateBlock theme={theme} tone="error" title={t("authors.dir.errorTitle")} body={say(t, errorKey)} action={t("common.tryAgain")} onAction={() => load(0)} />
  else if (!items.length)
    empty = query || kind || language ? (
      <StateBlock
        theme={theme}
        title={query ? t("authors.dir.noMatch", { query }) : t("authors.dir.noMatchFilter")}
        body={t("authors.dir.noMatchBody")}
        action={kind || language ? t("authors.dir.clearFilters") : undefined}
        onAction={kind || language ? () => { setKind(undefined); setLanguage(undefined) } : undefined}
      />
    ) : (
      <StateBlock theme={theme} title={t("authors.dir.empty.title")} body={t("authors.dir.empty.body")} action={t("authors.cta.become")} onAction={() => router.push(href(BECOME_AUTHOR_HREF))} />
    )

  return (
    <View style={[styles.root, { backgroundColor: theme.page }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <AccountBar theme={theme} title={t("authors.dir.title")} onBack={back} inset={topInset(insets.top)} />
      <FlatList
        data={state === "loading" || state === "error" ? [] : items}
        keyExtractor={(a) => a.slug}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => <AuthorRow theme={theme} author={item} onOpen={open} />}
        ListFooterComponent={
          items.length < total && state !== "loading" && state !== "error" ? (
            <View style={styles.pad}>
              <PillButton theme={theme} tone="line" busy={state === "more"} label={t("authors.dir.more")} onPress={() => load(items.length)} />
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: bottom + 24 }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { gap: 14, paddingBottom: 14 },
  pad: { paddingHorizontal: SIDE },
  search: { height: 52, borderRadius: 26, borderWidth: 1, paddingHorizontal: 20, fontFamily: amFonts.medium, fontSize: 16 },
  sorts: { flexDirection: "row", gap: 8, paddingHorizontal: SIDE, flexWrap: "wrap" },
  filterLabel: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, letterSpacing: 0.8, textTransform: "uppercase", paddingHorizontal: SIDE, marginBottom: -6 },
  filters: { flexDirection: "row", gap: 8, paddingHorizontal: SIDE },
  sep: { height: 8 },
})
