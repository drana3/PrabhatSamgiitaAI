import { useEffect, useRef, useState } from "react"
import { FlatList, StyleSheet, TextInput, View } from "react-native"
import { Stack, useLocalSearchParams, useRouter } from "expo-router"

import { AccountBar, topInset } from "@/components/account/AccountUi"
import { AuthorRow } from "@/components/authors/AuthorRow"
import { AuthorsCountLine, AuthorsFilterRow, FilterSheet, FiltersSheet } from "@/components/authors/AuthorsFilters"
import { DemoNote, LoadingRows, PillButton, SIDE, StateBlock } from "@/components/authors/AuthorsUi"
import { amFonts } from "@/constants/tokens/amTypography"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { authorsApi } from "@/lib/authors/api"
import { BECOME_AUTHOR_HREF, DIRECTORY_PAGE, DIRECTORY_ROLE_FILTER_LIVE, MY_AUTHOR_HREF, PROFILE_LANGUAGES, authorHref } from "@/lib/authors/constants"
import { say } from "@/lib/authors/text"
import { DIRECTORY_KINDS, DIRECTORY_ROLES, type AuthorCardData, type DirectoryKind, type DirectoryRole, type DirectorySort } from "@/lib/authors/types"
import { useT } from "@/lib/i18n"
import { kindLabel } from "@/lib/kirtan/kind"
import { errorKeyOf, useAuthorStore } from "@/stores/authorStore"
import { href } from "@/utils/href"
import { useSafeAreaInsets } from "react-native-safe-area-context"

const DELAY_MS = 300
/** The sung languages a person can filter by ("other" is a catch-all, not a language to look for). */
const LANGUAGE_CHOICES = PROFILE_LANGUAGES.filter((l) => l !== "other")

/** All authors: search, sort by listeners / new / name, a way into "Become an author", and every empty/error state. */
export default function AuthorsScreen() {
  const t = useT()
  const theme = useSongsTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const bottom = useScrollBottomInset()
  const params = useLocalSearchParams<{ q?: string; kind?: string; language?: string; role?: string }>()
  const api = authorsApi()
  const mine = useAuthorStore((s) => s.mine)
  const mineLoad = useAuthorStore((s) => s.load)
  const refreshMine = useAuthorStore((s) => s.refresh)
  const [typed, setTyped] = useState(String(params.q ?? ""))
  const [query, setQuery] = useState(typed.trim())
  const [sort, setSort] = useState<DirectorySort>("listeners")
  const [kind, setKind] = useState<DirectoryKind | undefined>(DIRECTORY_KINDS.find((k) => k === params.kind))
  const [language, setLanguage] = useState<string | undefined>(PROFILE_LANGUAGES.find((l) => l === params.language))
  // the Role filter needs the server's answer: shown in the preview, hidden against the real server until it has the parameter (lib/authors/constants.ts)
  const roleOffered = api.demo || DIRECTORY_ROLE_FILTER_LIVE
  const [role, setRole] = useState<DirectoryRole | undefined>(roleOffered ? DIRECTORY_ROLES.find((r) => r === params.role) : undefined)
  const [sheet, setSheet] = useState<"kind" | "language" | "filters" | null>(null)
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
    api.directory({ q: query, sort, kind, language, role, offset, limit: DIRECTORY_PAGE }).then(
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
  }, [query, sort, kind, language, role])

  const clearFilters = () => {
    setKind(undefined)
    setLanguage(undefined)
    setRole(undefined)
  }
  const filtered = Boolean(kind || language || role)
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
      <AuthorsFilterRow
        theme={theme}
        kindLabel={kind ? (kind === "prabhat_samgiita" ? t("authors.dir.kindShort.prabhat_samgiita") : kindLabel(kind)) : undefined}
        kindFull={kind ? kindLabel(kind) : undefined}
        languageLabel={language ? say(t, `authors.language.${language}`) : undefined}
        sort={sort}
        onKind={() => setSheet("kind")}
        onLanguage={() => setSheet("language")}
        onSort={setSort}
        combined={roleOffered ? { chosen: (kind ? 1 : 0) + (role ? 1 : 0), onPress: () => setSheet("filters") } : undefined}
      />
      <AuthorsCountLine
        theme={theme}
        count={(state === "ready" || state === "more") && items.length ? t("authors.count.authors", { count: total }) : ""}
        filtered={filtered && items.length > 0}
        onClear={clearFilters}
      />
    </View>
  )

  let empty: React.ReactNode = null
  if (state === "loading") empty = <LoadingRows theme={theme} rows={5} />
  else if (state === "error") empty = <StateBlock theme={theme} tone="error" title={t("authors.dir.errorTitle")} body={say(t, errorKey)} action={t("common.tryAgain")} onAction={() => load(0)} />
  else if (!items.length)
    empty = query || filtered ? (
      <StateBlock
        theme={theme}
        title={query ? t("authors.dir.noMatch", { query }) : t("authors.dir.noMatchFilter")}
        body={query ? t("authors.dir.noMatchBody") : t("authors.dir.noMatchFilterBody")}
        action={filtered ? t("authors.dir.clearFilters") : undefined}
        onAction={filtered ? clearFilters : undefined}
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
          <View style={styles.footer}>
            {items.length < total && state !== "loading" && state !== "error" ? (
              <PillButton theme={theme} tone="line" busy={state === "more"} label={t("authors.dir.more")} onPress={() => load(items.length)} />
            ) : null}
            {state === "ready" && items.length ? (
              <PillButton
                theme={theme}
                tone="line"
                label={mine ? t("authors.cta.mine") : t("authors.cta.become")}
                onPress={() => router.push(href(mine ? MY_AUTHOR_HREF : BECOME_AUTHOR_HREF))}
              />
            ) : null}
          </View>
        }
        contentContainerStyle={{ paddingBottom: bottom + 24 }}
      />
      <FilterSheet
        visible={sheet === "kind"}
        theme={theme}
        title={t("authors.dir.filter.kind")}
        options={DIRECTORY_KINDS.map((k) => ({ id: k, label: kindLabel(k) }))}
        value={kind}
        onPick={(id) => setKind(DIRECTORY_KINDS.find((k) => k === id))}
        onClose={() => setSheet(null)}
      />
      <FiltersSheet
        visible={sheet === "filters"}
        theme={theme}
        onClose={() => setSheet(null)}
        groups={[
          { key: "kind", title: t("authors.dir.filter.kind"), options: DIRECTORY_KINDS.map((k) => ({ id: k, label: kindLabel(k) })), value: kind, onPick: (id) => setKind(DIRECTORY_KINDS.find((k) => k === id)) },
          { key: "role", title: t("authors.dir.filter.role"), options: DIRECTORY_ROLES.map((r) => ({ id: r, label: t(`authors.dir.role.${r}`) })), value: role, onPick: (id) => setRole(DIRECTORY_ROLES.find((r) => r === id)) },
        ]}
      />
      <FilterSheet
        visible={sheet === "language"}
        theme={theme}
        title={t("authors.dir.filter.language")}
        options={LANGUAGE_CHOICES.map((l) => ({ id: l, label: say(t, `authors.language.${l}`) }))}
        value={language}
        onPick={(id) => setLanguage(LANGUAGE_CHOICES.find((l) => l === id))}
        onClose={() => setSheet(null)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { gap: 12, paddingBottom: 8 },
  pad: { paddingHorizontal: SIDE },
  search: { height: 48, borderRadius: 24, borderWidth: 1, paddingHorizontal: 20, fontFamily: amFonts.medium, fontSize: 16 },
  sep: { height: 8 },
  footer: { gap: 12, paddingHorizontal: SIDE, paddingTop: 16 },
})
